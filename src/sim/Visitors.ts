import { config } from '../data/config';
import type { World } from './World';
import { changeCash } from './Economy';
import type { Visitor } from './types';

let nextSpawnAt = 30;

// Path cells directly adjacent (4-way) to an enclosure cell.
let viewingSpots: { x: number; y: number }[] = [];
let viewingSpotsBuilt = false;

export function invalidateVisitorPathing(): void {
  viewingSpotsBuilt = false;
}

function walkable(world: World, x: number, y: number): boolean {
  const c = world.cell(x, y);
  if (!c) return false;
  if (c.buildingId) {
    const b = world.buildings.get(c.buildingId);
    return b?.type === 'EntranceGate';
  }
  return c.isPath;
}

function bfsPath(
  world: World,
  sx: number, sy: number,
  tx: number, ty: number,
): { x: number; y: number }[] | null {
  const { cols, rows } = config.grid;
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];
  if (!walkable(world, sx, sy) || !walkable(world, tx, ty)) return null;

  const visited = new Uint8Array(cols * rows);
  const parent = new Int32Array(cols * rows).fill(-1);
  const queue: number[] = [];
  const startIdx = sy * cols + sx;
  const endIdx = ty * cols + tx;

  visited[startIdx] = 1;
  queue.push(startIdx);

  let head = 0;
  outer: while (head < queue.length) {
    const idx = queue[head++]!;
    const cx = idx % cols;
    const cy = (idx / cols) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? -1 : d === 1 ? 1 : 0);
      const ny = cy + (d === 2 ? -1 : d === 3 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nidx = ny * cols + nx;
      if (visited[nidx] || !walkable(world, nx, ny)) continue;
      visited[nidx] = 1;
      parent[nidx] = idx;
      if (nidx === endIdx) break outer;
      queue.push(nidx);
    }
  }

  if (!visited[endIdx]) return null;

  // Reconstruct path from end back to start.
  const path: { x: number; y: number }[] = [];
  let cur = endIdx;
  while (cur !== startIdx) {
    path.push({ x: cur % cols, y: (cur / cols) | 0 });
    cur = parent[cur]!;
  }
  path.push({ x: sx, y: sy });
  path.reverse();
  return path;
}

function rebuildViewingSpots(world: World): void {
  viewingSpots = [];
  const { cols, rows } = config.grid;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = world.cell(x, y);
      if (!c?.isPath) continue;
      if (
        world.cell(x, y - 1)?.enclosureId ||
        world.cell(x, y + 1)?.enclosureId ||
        world.cell(x - 1, y)?.enclosureId ||
        world.cell(x + 1, y)?.enclosureId
      ) {
        viewingSpots.push({ x, y });
      }
    }
  }
  viewingSpotsBuilt = true;
  console.log(`[Visitors] viewing spots rebuilt: ${viewingSpots.length}`, viewingSpots.slice(0, 5));
}

function findGate(world: World) {
  for (const b of world.buildings.values()) {
    if (b.type === 'EntranceGate') return b;
  }
  return null;
}

function spawnIntervalTicks(world: World): number {
  const dinos = world.dinos.size;
  if (dinos === 0) return Infinity;
  const priceFactor = Math.max(0.1, 2 - world.admissionPrice / 20);
  return Math.max(4, Math.min(600, Math.round(60 / (dinos * priceFactor))));
}

export function tickVisitors(world: World): void {
  if (!viewingSpotsBuilt) rebuildViewingSpots(world);

  const cs = config.grid.cellSize;
  const gate = findGate(world);

  const toRemove: string[] = [];

  for (const v of world.visitors.values()) {
    const pathDone = v.path.length === 0 || v.pathIdx >= v.path.length;

    if (pathDone) {
      if (v.state === 'arriving') {
        v.state = 'viewing';
        v.viewIdleRemaining = world.rng.intRange(5, 20);
      }

      if (v.state === 'viewing') {
        if (v.viewIdleRemaining > 0) {
          v.viewIdleRemaining--;
          continue;
        }
        v.enclosuresViewed++;
        if (v.enclosuresViewed >= config.visitors.enclosuresPerVisit) {
          v.state = 'leaving';
        } else {
          const spot = pickSpot(world, v);
          if (spot && planPath(world, v, spot)) {
            v.state = 'arriving';
            continue;
          }
          v.state = 'leaving';
        }
      }

      if (v.state === 'leaving') {
        if (!gate || !planPath(world, v, { x: gate.x, y: gate.y })) {
          toRemove.push(v.id);
          continue;
        }
      }
    }

    // Move along path, consuming the full budget across multiple waypoints if needed.
    let budget = 22 * (config.time.tickMs / 1000);
    while (budget > 1e-6) {
      const node = v.path[v.pathIdx];
      if (!node) break;
      const tx = (node.x + 0.5) * cs;
      const ty = (node.y + 0.5) * cs;
      const dx = tx - v.x;
      const dy = ty - v.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= budget) {
        v.x = tx;
        v.y = ty;
        budget -= dist;
        v.pathIdx++;
        if (v.state === 'leaving' && v.pathIdx >= v.path.length) {
          toRemove.push(v.id);
          break;
        }
      } else {
        v.x += (dx / dist) * budget;
        v.y += (dy / dist) * budget;
        break;
      }
    }
  }

  for (const id of toRemove) world.visitors.delete(id);

  // Spawn — after loop so new visitors are processed next tick.
  if (gate && world.dinos.size > 0 && viewingSpots.length > 0) {
    if (world.tick >= nextSpawnAt) {
      spawnVisitor(world, gate);
      nextSpawnAt = world.tick + spawnIntervalTicks(world);
    }
  } else {
    nextSpawnAt = world.tick + 30;
  }
}

function pickSpot(
  world: World,
  exclude?: Visitor,
): { x: number; y: number } | null {
  if (viewingSpots.length === 0) return null;
  if (!exclude || viewingSpots.length === 1) return world.rng.pick(viewingSpots);
  const cs = config.grid.cellSize;
  const cx = Math.floor(exclude.x / cs);
  const cy = Math.floor(exclude.y / cs);
  const others = viewingSpots.filter(s => s.x !== cx || s.y !== cy);
  return world.rng.pick(others.length > 0 ? others : viewingSpots);
}

function spawnVisitor(world: World, gate: { x: number; y: number }): void {
  const cs = config.grid.cellSize;
  const px = (gate.x + 0.5) * cs;
  const py = (gate.y + 0.5) * cs;
  const v: Visitor = {
    id: world.newId('visitor'),
    x: px,
    y: py,
    prevX: px,
    prevY: py,
    state: 'arriving',
    enclosuresViewed: 0,
    path: [],
    pathIdx: 0,
    viewIdleRemaining: 0,
    targetCell: null,
  };
  world.visitors.set(v.id, v);
  changeCash(world, world.admissionPrice, 'admission');
  const spot = pickSpot(world);
  const ok = spot ? planPath(world, v, spot) : false;
  console.log(`[Visitors] spawned ${v.id} at gate(${gate.x},${gate.y}), spot=${JSON.stringify(spot)}, pathOk=${ok}, pathLen=${v.path.length}`);
}

function planPath(
  world: World,
  v: Visitor,
  target: { x: number; y: number },
): boolean {
  const cs = config.grid.cellSize;
  const sx = Math.floor(v.x / cs);
  const sy = Math.floor(v.y / cs);
  const path = bfsPath(world, sx, sy, target.x, target.y);
  if (!path) {
    console.warn(`[Visitors] no path (${sx},${sy}) → (${target.x},${target.y})`);
    return false;
  }
  v.path = path;
  v.pathIdx = 0;
  v.targetCell = target;
  return true;
}
