import { emit, Events } from '../EventBus';
import { config } from '../data/config';
import { BUILDINGS } from '../data/buildings';
import type { World } from './World';
import { changeCash } from './Economy';
import type { Building, Ranger } from './types';
import {
  findNearestStaffTarget,
  findStaffPath,
  isInStationRange,
  staffWalkableCell,
} from './StaffPathing';
import { poopCellKey } from './World';

const RANGER_NAMES = [
  'Avery', 'Blake', 'Casey', 'Dani', 'Ezra', 'Finley', 'Gray',
  'Harper', 'Iris', 'Jules', 'Kai', 'Lior', 'Morgan', 'Noa',
  'Oren', 'Pax', 'Quinn', 'Reese', 'Sage', 'Tate',
];

const RANGER_SPEED_PX_PER_SEC = 28;
const POOP_CLEAN_SECONDS = 2;

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
    taskPoopId: null,
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

export function reassignRanger(
  world: World,
  rangerId: string,
  newStationId: string,
): { ok: true } | { ok: false; reason: string } {
  const r = world.rangers.get(rangerId);
  if (!r) return { ok: false, reason: 'Ranger not found.' };
  const station = world.buildings.get(newStationId);
  if (!station || station.type !== 'RangerStation') {
    return { ok: false, reason: 'Target is not a ranger station.' };
  }
  if (r.stationId === newStationId) return { ok: true };
  const count = Array.from(world.rangers.values()).filter(
    (other) => other.stationId === newStationId,
  ).length;
  if (count >= config.ranger.maxPerStation) {
    return { ok: false, reason: 'That station is full.' };
  }
  const fromStationId = r.stationId;
  r.stationId = newStationId;
  emit(Events.RangerReassigned, { rangerId, fromStationId, toStationId: newStationId });
  world.log(`Reassigned ranger ${r.name} to a different station.`);
  return { ok: true };
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
      // Don't interrupt an in-progress poop cleanup — it's stationary and almost done.
      if (r.state !== 'idle' && r.state !== 'cleaning-poop') {
        r.state = 'idle';
        r.taskFeederId = null;
        r.taskPoopId = null;
      }
    }

    // Cleaning poop: stand still for POOP_CLEAN_SECONDS then remove it.
    if (r.state === 'cleaning-poop') {
      r.cleanTicksRemaining = (r.cleanTicksRemaining ?? 0) - 1;
      if (r.cleanTicksRemaining <= 0) {
        if (r.taskPoopId) cleanupPoop(world, r.taskPoopId);
        r.taskPoopId = null;
        r.cleanTicksRemaining = 0;
        r.state = 'idle';
      }
      continue;
    }

    // Idle → assign nearest in-range task (poop or feeder), whichever is closer.
    if (r.state === 'idle') {
      const task = findNearestTaskForRanger(world, station, { x: rcx, y: rcy });
      if (task) {
        if (task.kind === 'feeder') {
          r.state = 'walking-to-feeder';
          r.taskFeederId = task.id;
        } else {
          r.state = 'walking-to-poop';
          r.taskPoopId = task.id;
        }
        r.path = task.path;
        r.pathIdx = 0;
        r.goalCell = task.goalCell;
        r.pathEpoch = world.staffPathEpoch;
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
      } else if (r.state === 'walking-to-poop' && r.taskPoopId) {
        // Stay here and clean for POOP_CLEAN_SECONDS before removing the poop.
        r.path = [];
        r.pathIdx = 0;
        r.goalCell = null;
        r.state = 'cleaning-poop';
        r.cleanTicksRemaining = Math.max(1, Math.round(POOP_CLEAN_SECONDS * 1000 / config.time.tickMs));
        continue;
      }
      r.path = [];
      r.pathIdx = 0;
      r.goalCell = null;
      r.taskFeederId = null;
      r.taskPoopId = null;
      r.state = 'idle';
    }
  }
}

function cleanupPoop(world: World, poopId: string): void {
  const p = world.poops.get(poopId);
  if (!p) return;
  world.poops.delete(poopId);
  world.poopByCell.delete(poopCellKey(p.x, p.y));
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

type TaskCandidate =
  | { kind: 'feeder'; id: string }
  | { kind: 'poop'; id: string };

type TaskSelection = TaskCandidate & {
  path: { x: number; y: number }[];
  goalCell: { x: number; y: number };
};

// Build the set of candidate goal cells (poop tiles + feeder approach tiles)
// within this station's service range, then run a single BFS from the ranger
// to pick whichever is closest. If a feeder has multiple staff-walkable
// neighbors, all of them are added as goals so BFS finds the cheapest approach.
function findNearestTaskForRanger(
  world: World,
  station: Building,
  from: { x: number; y: number },
): TaskSelection | null {
  const cols = config.grid.cols;
  const range = BUILDINGS.RangerStation.serviceRange ?? Number.POSITIVE_INFINITY;

  const claimedFeeders = new Set<string>();
  const claimedPoops = new Set<string>();
  for (const other of world.rangers.values()) {
    if (other.taskFeederId) claimedFeeders.add(other.taskFeederId);
    if (other.taskPoopId) claimedPoops.add(other.taskPoopId);
  }

  const goalCells = new Map<number, TaskCandidate>();

  // Low feeders → approach cells.
  const threshold = config.feeder.capacity * config.feeder.refillThresholdRatio;
  for (const b of world.buildings.values()) {
    if (b.type !== 'Feeder') continue;
    if (claimedFeeders.has(b.id)) continue;
    if ((b.food ?? 0) >= threshold) continue;
    if (!isInStationRange(station, range, b.x, b.y)) continue;
    for (let dy = 0; dy < b.height; dy++) {
      for (let dx = 0; dx < b.width; dx++) {
        const tx = b.x + dx;
        const ty = b.y + dy;
        const neighbors = [
          { x: tx - 1, y: ty },
          { x: tx + 1, y: ty },
          { x: tx, y: ty - 1 },
          { x: tx, y: ty + 1 },
        ];
        for (const n of neighbors) {
          if (!staffWalkableCell(world, n.x, n.y)) continue;
          const idx = n.y * cols + n.x;
          // Don't let a poop on this same cell get clobbered — feeder approach
          // and standing-on-poop both work equally well, take whichever was
          // added first (poops are added second below).
          if (!goalCells.has(idx)) goalCells.set(idx, { kind: 'feeder', id: b.id });
        }
      }
    }
  }

  // Unclaimed poops → their own cells.
  for (const p of world.poops.values()) {
    if (claimedPoops.has(p.id)) continue;
    if (!isInStationRange(station, range, p.x, p.y)) continue;
    if (!staffWalkableCell(world, p.x, p.y)) continue;
    const idx = p.y * cols + p.x;
    goalCells.set(idx, { kind: 'poop', id: p.id });
  }

  if (goalCells.size === 0) return null;

  const result = findNearestStaffTarget(world, from, goalCells);
  if (!result) return null;
  return { ...result.target, path: result.path, goalCell: result.goalCell };
}
