import { emit, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from './World';
import { getSpecies } from '../data/species';
import type { Dino, PendingHatchling } from './types';

export function startHatch(world: World, hatcheryId: string, speciesId: string): boolean {
  const dna = world.dna[speciesId] ?? 0;
  if (dna < config.expedition.hatchThreshold) return false;
  const hatchery = world.buildings.get(hatcheryId);
  if (!hatchery || hatchery.type !== 'Hatchery') return false;
  if (world.hatchInProgress.find((h) => h.hatcheryId === hatcheryId)) return false;
  world.hatchInProgress.push({
    hatcheryId,
    speciesId,
    finishesAtTick: world.tick + config.expedition.hatchTicks,
  });
  emit(Events.HatchStarted, { hatcheryId, speciesId });
  world.log(`Hatching ${getSpecies(speciesId).displayName}…`);
  return true;
}

export function tickHatchery(world: World): void {
  for (let i = world.hatchInProgress.length - 1; i >= 0; i--) {
    const h = world.hatchInProgress[i]!;
    if (world.tick >= h.finishesAtTick) {
      world.hatchInProgress.splice(i, 1);
      const hatchling: PendingHatchling = {
        id: world.newId('hatchling'),
        speciesId: h.speciesId,
      };
      world.pendingHatchlings.push(hatchling);
      emit(Events.HatchReady, hatchling);
      world.log(`Hatchling ready: ${getSpecies(h.speciesId).displayName}.`);
    }
  }
}

export function pickUpHatchling(world: World, hatchlingId: string): boolean {
  const h = world.pendingHatchlings.find((x) => x.id === hatchlingId);
  if (!h) return false;
  if (world.carryHatchlingId) return false;
  world.carryHatchlingId = hatchlingId;
  emit(Events.HatchPickedUp, h);
  return true;
}

export function cancelCarry(world: World): void {
  world.carryHatchlingId = null;
}

// Place the carried hatchling into a cell. Returns null on success, error msg otherwise.
export function placeHatchling(world: World, cellX: number, cellY: number): string | null {
  if (!world.carryHatchlingId) return 'no hatchling in carry';
  const h = world.pendingHatchlings.find((x) => x.id === world.carryHatchlingId);
  if (!h) return 'hatchling vanished';
  const cell = world.cell(cellX, cellY);
  if (!cell) return 'out of bounds';
  if (!cell.enclosureId) return 'must drop inside an enclosure';
  const enc = world.enclosures.get(cell.enclosureId);
  if (!enc) return 'enclosure missing';
  if (enc.speciesId && enc.speciesId !== h.speciesId) {
    return `enclosure already houses ${getSpecies(enc.speciesId).displayName}`;
  }
  if (!enc.speciesId) {
    enc.speciesId = h.speciesId;
  }
  // Spawn dino at click position.
  const cs = config.grid.cellSize;
  const species = getSpecies(h.speciesId);
  const num = (world.nextDinoNumber[h.speciesId] ?? 0) + 1;
  world.nextDinoNumber[h.speciesId] = num;
  const dino: Dino = {
    id: world.newId('dino'),
    speciesId: h.speciesId,
    name: `${species.displayName} ${num}`,
    birthTick: world.tick,
    enclosureId: enc.id,
    x: (cellX + 0.5) * cs,
    y: (cellY + 0.5) * cs,
    prevX: (cellX + 0.5) * cs,
    prevY: (cellY + 0.5) * cs,
    satiation: 100,
    health: 100,
    dnaPercentAtHatch: world.dna[h.speciesId] ?? 0,
    waypoint: null,
    nextWanderAt: world.tick + 1,
  };
  world.dinos.set(dino.id, dino);
  // Remove from pending.
  world.pendingHatchlings = world.pendingHatchlings.filter((x) => x.id !== h.id);
  world.carryHatchlingId = null;
  emit(Events.HatchPlaced, { dinoId: dino.id, enclosureId: enc.id });
  world.log(`Placed ${dino.name} in enclosure.`);
  return null;
}
