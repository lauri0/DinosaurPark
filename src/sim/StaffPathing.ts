import { config } from '../data/config';
import { isStaffWalkableBuilding } from '../data/buildings';
import type { Building } from './types';
import type { World } from './World';

// Cell predicate: can a staff member stand on this cell?
export function staffWalkableCell(world: World, x: number, y: number): boolean {
  const c = world.cell(x, y);
  return !!c && c.walkableForStaff;
}

// Edge predicate: can a staff member step from (x,y) across `side` to its neighbor?
// Fence blocks; gate is passable. Map edge handled implicitly by neighbor bounds.
export function canStaffCrossEdge(
  world: World,
  x: number, y: number,
  side: 'N' | 'E' | 'S' | 'W',
): boolean {
  return !world.isEdgeBlocked(x, y, side);
}

// 4-neighbor BFS over staff-walkable cells, blocked by fences (gates pass).
// Returns a path of cells inclusive of start and goal, or null if unreachable.
export function findStaffPath(
  world: World,
  start: { x: number; y: number },
  goal: { x: number; y: number },
): { x: number; y: number }[] | null {
  const { cols, rows } = config.grid;
  const sx = start.x, sy = start.y;
  const tx = goal.x, ty = goal.y;
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];
  if (!staffWalkableCell(world, sx, sy)) return null;
  if (!staffWalkableCell(world, tx, ty)) return null;

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
    // N, E, S, W
    const dirs: { dx: number; dy: number; side: 'N' | 'E' | 'S' | 'W' }[] = [
      { dx: 0, dy: -1, side: 'N' },
      { dx: 1, dy: 0, side: 'E' },
      { dx: 0, dy: 1, side: 'S' },
      { dx: -1, dy: 0, side: 'W' },
    ];
    for (const d of dirs) {
      const nx = cx + d.dx;
      const ny = cy + d.dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (!canStaffCrossEdge(world, cx, cy, d.side)) continue;
      const nidx = ny * cols + nx;
      if (visited[nidx]) continue;
      if (!staffWalkableCell(world, nx, ny)) continue;
      visited[nidx] = 1;
      parent[nidx] = idx;
      if (nidx === endIdx) break outer;
      queue.push(nidx);
    }
  }

  if (!visited[endIdx]) return null;

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

// Pick a staff-reachable goal cell for a building. If the building's own footprint
// is staff-walkable, return its center cell. Otherwise return the nearest
// 4-neighbor cell to the footprint that is staff-walkable.
export function findStaffGoalNear(
  world: World,
  b: Building,
): { x: number; y: number } | null {
  if (isStaffWalkableBuilding(b.type)) {
    return { x: b.x + Math.floor(b.width / 2), y: b.y + Math.floor(b.height / 2) };
  }
  const candidates: { x: number; y: number }[] = [];
  for (let dy = 0; dy < b.height; dy++) {
    for (let dx = 0; dx < b.width; dx++) {
      const tx = b.x + dx, ty = b.y + dy;
      const neighbors = [
        { x: tx - 1, y: ty },
        { x: tx + 1, y: ty },
        { x: tx, y: ty - 1 },
        { x: tx, y: ty + 1 },
      ];
      for (const n of neighbors) {
        if (staffWalkableCell(world, n.x, n.y)) candidates.push(n);
      }
    }
  }
  if (candidates.length === 0) return null;
  // Prefer the first candidate; BFS will figure out reachability from caller.
  return candidates[0]!;
}

export function invalidateStaffPathing(world: World): void {
  world.staffPathEpoch++;
}
