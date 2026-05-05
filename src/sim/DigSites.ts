import { emit, Events } from '../EventBus';
import { config, degradeQuality } from '../data/config';
import { DIG_SITES } from '../data/digSites';
import type { FossilHaul, PendingHaul } from './types';
import type { World } from './World';
import { changeCash } from './Economy';

export function dispatchExpedition(world: World, siteId: string): boolean {
  if (world.activeExpedition) return false;
  if (world.pendingHaul) return false;
  const def = DIG_SITES.find((s) => s.id === siteId);
  const state = world.digSites.get(siteId);
  if (!def || !state) return false;
  if (!state.unlocked) return false;
  if (state.quality === 'Exhausted') return false;
  if (world.cash < def.teamCost) return false;
  changeCash(world, -def.teamCost, `dispatch ${def.name}`);
  world.activeExpedition = {
    siteId,
    finishesAtTick: world.tick + def.expeditionDurationTicks,
  };
  emit(Events.ExpeditionDispatched, { siteId });
  world.log(`Expedition dispatched to ${def.name}.`);
  return true;
}

export function unlockDigSite(world: World, siteId: string): boolean {
  const state = world.digSites.get(siteId);
  if (!state || state.unlocked) return false;
  const unlockedCount = Array.from(world.digSites.values()).filter((s) => s.unlocked).length;
  const idx = unlockedCount - 1; // 1 already unlocked → first cost is index 0
  const cost = config.economy.digSiteUnlockCosts[idx] ?? Infinity;
  if (world.cash < cost) return false;
  changeCash(world, -cost, 'unlock dig site');
  state.unlocked = true;
  const def = DIG_SITES.find((s) => s.id === siteId);
  world.log(`Unlocked dig site: ${def?.name ?? siteId}.`);
  return true;
}

export function tickDigSites(world: World): void {
  if (!world.activeExpedition) return;
  if (world.tick < world.activeExpedition.finishesAtTick) return;
  // Resolve.
  const exp = world.activeExpedition;
  world.activeExpedition = null;
  resolveHaul(world, exp.siteId);
}

function resolveHaul(world: World, siteId: string): void {
  const def = DIG_SITES.find((s) => s.id === siteId);
  const state = world.digSites.get(siteId);
  if (!def || !state) return;

  const fossilCount = config.expedition.qualityToFossilCount[state.quality];
  const [dnaMin, dnaMax] = config.expedition.qualityToDnaRange[state.quality];
  const fossils: FossilHaul[] = [];
  for (let i = 0; i < fossilCount; i++) {
    const speciesId = world.rng.pick(def.species);
    const dna = Math.round(world.rng.range(dnaMin, dnaMax));
    fossils.push({
      id: world.newId('fossil'),
      siteId,
      speciesId,
      dnaPercent: dna,
    });
  }
  let valuables = 0;
  if (world.rng.chance(config.expedition.valuableChance)) {
    valuables = config.economy.valuableSalePrice;
    changeCash(world, valuables, 'valuable sale');
  }
  // Degrade quality.
  if (world.rng.chance(config.expedition.degradeChance)) {
    state.quality = degradeQuality(state.quality);
  }

  const haul: PendingHaul = {
    siteId,
    fossils,
    valuables,
    decided: Object.fromEntries(fossils.map((f) => [f.id, null])),
  };
  world.pendingHaul = haul;
  emit(Events.ExpeditionReturned, { siteId, fossilCount: fossils.length });
  world.log(
    `Expedition to ${def.name} returned with ${fossils.length} fossil${
      fossils.length === 1 ? '' : 's'
    }.${valuables > 0 ? ` Bonus valuable sold for $${valuables}.` : ''}`,
  );
}

export function decideFossil(
  world: World,
  fossilId: string,
  decision: 'extract' | 'sell',
): void {
  const haul = world.pendingHaul;
  if (!haul) return;
  const fossil = haul.fossils.find((f) => f.id === fossilId);
  if (!fossil) return;
  if (haul.decided[fossilId] !== null) return;
  haul.decided[fossilId] = decision;

  if (decision === 'extract') {
    const before = world.dna[fossil.speciesId] ?? 0;
    const after = Math.min(config.expedition.dnaCap, before + fossil.dnaPercent);
    world.dna[fossil.speciesId] = after;
    emit(Events.FossilExtracted, { speciesId: fossil.speciesId, before, after });
  } else {
    const earn = fossil.dnaPercent * config.economy.fossilSalePerDnaPercent;
    changeCash(world, earn, 'fossil sale');
    emit(Events.FossilSold, { speciesId: fossil.speciesId, amount: earn });
  }

  // Auto-close when all decided.
  if (haul.fossils.every((f) => haul.decided[f.id] !== null)) {
    world.pendingHaul = null;
  }
}

export function dismissHaulIfEmpty(world: World): void {
  if (world.pendingHaul && world.pendingHaul.fossils.length === 0) {
    world.pendingHaul = null;
  }
}
