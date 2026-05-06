import { emit, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from './World';
import { changeCash } from './Economy';
import type { Building, Ranger } from './types';
import { findStaffGoalNear, findStaffPath, staffWalkableCell } from './StaffPathing';

const RANGER_NAMES = [
  'Avery', 'Blake', 'Casey', 'Dani', 'Ezra', 'Finley', 'Gray',
  'Harper', 'Iris', 'Jules', 'Kai', 'Lior', 'Morgan', 'Noa',
  'Oren', 'Pax', 'Quinn', 'Reese', 'Sage', 'Tate',
];

const RANGER_SPEED_PX_PER_SEC = 28;

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
    taskFeederId: null,
    path: [],
    pathIdx: 0,
    goalCell: null,
    pathEpoch: world.staffPathEpoch,
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
  const cs = config.grid.cellSize;
  for (const r of world.rangers.values()) {
    const station = world.buildings.get(r.stationId);
    if (!station) continue;

    const rcx = Math.floor(r.x / cs);
    const rcy = Math.floor(r.y / cs);

    // Invalidate stale path.
    if (r.pathEpoch !== world.staffPathEpoch) {
      r.path = [];
      r.pathIdx = 0;
      r.pathEpoch = world.staffPathEpoch;
      r.goalCell = null;
      // If we were mid-task, drop the claim so re-planning can re-pick.
      if (r.state === 'walking-to-feeder' || r.state === 'returning-to-station' || r.state === 'wandering' || r.state === 'stranded') {
        r.state = 'idle';
        r.taskFeederId = null;
      }
    }

    // Idle → assign work.
    if (r.state === 'idle') {
      const feeder = findLowFeeder(world);
      if (feeder) {
        const goal = findStaffGoalNear(world, feeder);
        const path = goal ? findStaffPath(world, { x: rcx, y: rcy }, goal) : null;
        if (path && goal) {
          r.state = 'walking-to-feeder';
          r.taskFeederId = feeder.id;
          r.path = path;
          r.pathIdx = 0;
          r.goalCell = goal;
          r.pathEpoch = world.staffPathEpoch;
        } else if (goal && !path) {
          // Surface a one-time notification per task assignment.
          world.log(`Ranger ${r.name}: feeder unreachable.`);
          // Mark this feeder as claimed by leaving taskFeederId null and going wandering
          // to avoid spamming the log every tick. Try again after the world changes.
        }
      }
      // If no task or no path, fall through to wandering.
      if (r.state === 'idle') {
        const goal = pickWanderGoal(world, r, station);
        if (goal) {
          const path = findStaffPath(world, { x: rcx, y: rcy }, goal);
          if (path) {
            r.state = 'wandering';
            r.path = path;
            r.pathIdx = 0;
            r.goalCell = goal;
            r.pathEpoch = world.staffPathEpoch;
          }
        }
      }
    }

    // Follow path.
    if (r.path.length > 0 && r.pathIdx < r.path.length) {
      let budget = RANGER_SPEED_PX_PER_SEC * (config.time.tickMs / 1000);
      while (budget > 1e-6) {
        const node = r.path[r.pathIdx];
        if (!node) break;
        const tx = (node.x + 0.5) * cs;
        const ty = (node.y + 0.5) * cs;
        const dx = tx - r.x;
        const dy = ty - r.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= budget) {
          r.x = tx;
          r.y = ty;
          budget -= dist;
          r.pathIdx++;
        } else {
          r.x += (dx / dist) * budget;
          r.y += (dy / dist) * budget;
          break;
        }
      }
    }

    const arrived = r.path.length > 0 && r.pathIdx >= r.path.length;

    if (arrived) {
      if (r.state === 'walking-to-feeder' && r.taskFeederId) {
        const feeder = world.buildings.get(r.taskFeederId);
        if (feeder) refillFeeder(world, feeder);
      }
      r.path = [];
      r.pathIdx = 0;
      r.goalCell = null;
      r.taskFeederId = null;
      r.state = 'idle';
    }
  }
}

function refillFeeder(world: World, feeder: Building): void {
  const before = feeder.food ?? 0;
  feeder.food = config.feeder.capacity;
  const cost = (config.feeder.capacity - before) * config.economy.foodCostPerUnit;
  if (cost > 0) changeCash(world, -cost, 'feeder refill');
}

function pickWanderGoal(world: World, r: Ranger, station: Building): { x: number; y: number } | null {
  // Pick a random staff-walkable cell within K tiles of the station (Chebyshev).
  const K = 6;
  const stationCx = station.x + Math.floor(station.width / 2);
  const stationCy = station.y + Math.floor(station.height / 2);
  for (let attempt = 0; attempt < 12; attempt++) {
    const dx = world.rng.intRange(-K, K);
    const dy = world.rng.intRange(-K, K);
    const gx = stationCx + dx;
    const gy = stationCy + dy;
    if (staffWalkableCell(world, gx, gy)) return { x: gx, y: gy };
  }
  // Fallback: stay on station.
  void r;
  return { x: stationCx, y: stationCy };
}

function findLowFeeder(world: World): Building | null {
  const threshold = config.feeder.capacity * config.feeder.refillThresholdRatio;
  const claimed = new Set<string>();
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
