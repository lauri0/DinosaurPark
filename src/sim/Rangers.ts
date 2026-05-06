import { emit, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from './World';
import { changeCash } from './Economy';
import type { Ranger } from './types';
import { stepToward } from './Dinos';

const RANGER_NAMES = [
  'Avery', 'Blake', 'Casey', 'Dani', 'Ezra', 'Finley', 'Gray',
  'Harper', 'Iris', 'Jules', 'Kai', 'Lior', 'Morgan', 'Noa',
  'Oren', 'Pax', 'Quinn', 'Reese', 'Sage', 'Tate',
];

export function hireRanger(world: World, stationId: string): boolean {
  const station = world.buildings.get(stationId);
  if (!station || station.type !== 'RangerStation') return false;
  const count = Array.from(world.rangers.values()).filter(
    (r) => r.stationId === stationId,
  ).length;
  if (count >= config.ranger.maxPerStation) return false;
  const center = world.buildingCenterPx(station);
  const r: Ranger = {
    id: world.newId('ranger'),
    name: world.rng.pick(RANGER_NAMES),
    stationId,
    x: center.x,
    y: center.y,
    prevX: center.x,
    prevY: center.y,
    state: 'idle',
    waypoint: null,
  };
  world.rangers.set(r.id, r);
  emit(Events.RangerHired, { rangerId: r.id, stationId });
  world.log(`Hired ranger ${r.name}.`);
  return true;
}

export function fireRanger(world: World, rangerId: string): boolean {
  const r = world.rangers.get(rangerId);
  if (!r) return false;
  world.rangers.delete(rangerId);
  emit(Events.RangerFired, { rangerId, stationId: r.stationId });
  world.log(`Fired ranger ${r.name}.`);
  return true;
}

export function tickRangers(world: World): void {
  for (const r of world.rangers.values()) {
    const station = world.buildings.get(r.stationId);
    if (!station) continue;

    // Find a feeder needing refill if not already on one.
    if (r.state === 'idle') {
      const target = findLowFeeder(world);
      if (target) {
        r.state = 'walking-to-feeder';
        r.taskFeederId = target.id;
        r.waypoint = world.buildingCenterPx(target);
      }
    }

    if (r.state === 'walking-to-feeder' && r.taskFeederId) {
      const feeder = world.buildings.get(r.taskFeederId);
      if (!feeder) {
        r.state = 'idle';
        r.taskFeederId = null;
        r.waypoint = null;
      } else {
        const target = world.buildingCenterPx(feeder);
        r.waypoint = target;
        const dist = Math.hypot(target.x - r.x, target.y - r.y);
        if (dist < config.grid.cellSize * 0.7) {
          // Refill instantly.
          const before = feeder.food ?? 0;
          feeder.food = config.feeder.capacity;
          const cost = (config.feeder.capacity - before) * config.economy.foodCostPerUnit;
          if (cost > 0) changeCash(world, -cost, 'feeder refill');
          r.state = 'idle';
          r.taskFeederId = null;
          r.waypoint = null;
        } else {
          stepToward(r, target, 28);
        }
      }
    } else {
      // Idle wander near station.
      if (!r.waypoint || Math.hypot(r.waypoint.x - r.x, r.waypoint.y - r.y) < 2) {
        const center = world.buildingCenterPx(station);
        const cs = config.grid.cellSize;
        r.waypoint = {
          x: center.x + (world.rng.next() - 0.5) * cs * 4,
          y: center.y + (world.rng.next() - 0.5) * cs * 4,
        };
      }
      if (r.waypoint) {
        stepToward(r, r.waypoint, 18);
      }
    }
  }
}

function findLowFeeder(world: World) {
  const threshold = config.feeder.capacity * config.feeder.refillThresholdRatio;
  let claimed = new Set<string>();
  for (const r of world.rangers.values()) {
    if (r.taskFeederId) claimed.add(r.taskFeederId);
  }
  for (const b of world.buildings.values()) {
    if (b.type !== 'Feeder') continue;
    if (claimed.has(b.id)) continue;
    if ((b.food ?? 0) < threshold) return b;
  }
  return null;
}
