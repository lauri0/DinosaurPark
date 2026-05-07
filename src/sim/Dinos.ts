import { config } from '../data/config';
import { getSpecies } from '../data/species';
import type { World } from './World';
import { poopCellKey } from './World';
import type { Poop } from './types';
// type Dino imported via inference from World

export function tickDinos(world: World): void {
  const cs = config.grid.cellSize;
  const toRemove: string[] = [];

  // Determine the current eater at each feeder (one dino per feeder).
  // First dino in iteration order that's already at the feeder claims it.
  const feederOwner = new Map<string, string>();
  for (const d of world.dinos.values()) {
    if (!d.eatingFeederId) continue;
    if (feederOwner.has(d.eatingFeederId)) continue;
    const f = world.buildings.get(d.eatingFeederId);
    if (!f) continue;
    const fc = world.buildingCenterPx(f);
    if (Math.hypot(fc.x - d.x, fc.y - d.y) < cs * 0.6) {
      feederOwner.set(d.eatingFeederId, d.id);
    }
  }

  for (const d of world.dinos.values()) {
    if (d.enclosureId === null) continue; // carried (shouldn't happen with current model)
    const sp = getSpecies(d.speciesId);

    // Hunger / health.
    d.satiation = Math.max(0, d.satiation - sp.satiationDropRate);
    if (d.satiation === 0) {
      d.health = Math.max(0, d.health - config.dinos.starvationHealthDrop);
      if (d.health === 0) {
        toRemove.push(d.id);
        world.log(`${sp.displayName} has died of starvation.`);
        continue;
      }
      // Starving notification once per dip below threshold (every 20 ticks).
      if (world.tick % 20 === 0) {
        world.log(`${sp.displayName} is starving.`);
      }
    }

    // Eating: trigger when hungry; once started, keep eating until full or feeder empties.
    const startEating = d.satiation < config.dinos.eatTriggerSatiation;
    const continueEating = d.eatingFeederId != null && d.satiation < 100;
    if (startEating || continueEating) {
      const feeder = findFeederForEnclosure(world, d.enclosureId);
      if (feeder && (feeder.food ?? 0) > 0) {
        const fc = world.buildingCenterPx(feeder);
        d.waypoint = fc;
        d.eatingFeederId = feeder.id;
        const dx = fc.x - d.x;
        const dy = fc.y - d.y;
        const dist = Math.hypot(dx, dy);
        const arrived = dist < cs * 0.6;
        if (arrived) {
          // Only one dino can eat at a feeder at a time. Others wait nearby.
          const owner = feederOwner.get(feeder.id);
          if (owner && owner !== d.id) {
            // Stand by; don't move, don't eat. Will retry next tick.
            continue;
          }
          if (!owner) feederOwner.set(feeder.id, d.id);
          const eat = Math.min(sp.eatAmount * 0.01, feeder.food ?? 0);
          feeder.food = (feeder.food ?? 0) - eat;
          d.satiation = Math.min(100, d.satiation + (eat * 100) / sp.eatAmount);
          if (d.satiation >= 100) {
            // Fully sated — leave the feeder; will only return when hungry again.
            d.eatingFeederId = null;
            d.waypoint = null;
            feederOwner.delete(feeder.id);
          }
        } else {
          stepToward(d, fc, sp.baseSpeed);
        }
        continue;
      }
    }

    d.eatingFeederId = null;

    // Wander.
    if (!d.waypoint || world.tick >= d.nextWanderAt) {
      const enc = world.enclosures.get(d.enclosureId);
      if (enc) {
        const c = world.rng.pick(enc.cells);
        d.waypoint = { x: (c.x + 0.5) * cs, y: (c.y + 0.5) * cs };
        const variance = 0.5 + world.rng.next();
        d.nextWanderAt = world.tick + Math.max(1, Math.round(sp.wanderFreq * variance));
      } else {
        d.waypoint = null;
        d.enclosureId = null;
      }
    }
    if (d.waypoint) {
      const dx = d.waypoint.x - d.x;
      const dy = d.waypoint.y - d.y;
      if (Math.hypot(dx, dy) < 2) {
        d.waypoint = null;
        maybeSpawnPoop(world, d, sp.poopChance);
      } else {
        stepToward(d, d.waypoint, sp.baseSpeed);
      }
    }
  }
  for (const id of toRemove) world.dinos.delete(id);
}

function stepToward(d: { x: number; y: number }, target: { x: number; y: number }, pxPerSec: number): void {
  const dx = target.x - d.x;
  const dy = target.y - d.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.01) return;
  const stepPx = pxPerSec * (config.time.tickMs / 1000);
  const k = Math.min(1, stepPx / dist);
  d.x += dx * k;
  d.y += dy * k;
}

function findFeederForEnclosure(world: World, enclosureId: string) {
  for (const b of world.buildings.values()) {
    if (b.type !== 'Feeder') continue;
    // Feeder considered "in enclosure" if any of its cells share that enclosureId.
    for (let dy = 0; dy < b.height; dy++) {
      for (let dx = 0; dx < b.width; dx++) {
        const c = world.cell(b.x + dx, b.y + dy);
        if (c?.enclosureId === enclosureId) return b;
      }
    }
  }
  return null;
}

function maybeSpawnPoop(world: World, d: { x: number; y: number; enclosureId: string | null }, chance: number): void {
  if (!d.enclosureId) return;
  if (chance <= 0) return;
  if (world.rng.next() >= chance) return;
  const cs = config.grid.cellSize;
  const cx = Math.floor(d.x / cs);
  const cy = Math.floor(d.y / cs);
  const cell = world.cell(cx, cy);
  if (!cell || cell.enclosureId !== d.enclosureId) return;
  const key = poopCellKey(cx, cy);
  if (world.poopByCell.has(key)) return;
  const p: Poop = {
    id: world.newId('poop'),
    x: cx,
    y: cy,
    enclosureId: d.enclosureId,
    spawnedAtTick: world.tick,
  };
  world.poops.set(p.id, p);
  world.poopByCell.set(key, p.id);
}

export { stepToward };
