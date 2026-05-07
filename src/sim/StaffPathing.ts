import { config } from '../data/config';
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

export function invalidateStaffPathing(world: World): void {
  world.staffPathEpoch++;
}

// Multi-goal BFS: expand from `from` over staff-walkable cells (fences blocking,
// gates passable) and stop the first time we touch any cell present in
// `goalCells`. The first goal popped is the closest (in path-length terms)
// reachable goal, by BFS's level-order property. Returns the matching target
// payload, the goal cell, and the full path inclusive of start and goal.
export function findNearestStaffTarget<T>(
  world: World,
  from: { x: number; y: number },
  goalCells: Map<number, T>,
): { target: T; goalCell: { x: number; y: number }; path: { x: number; y: number }[] } | null {
  if (goalCells.size === 0) return null;
  const { cols, rows } = config.grid;
  const sx = from.x, sy = from.y;
  if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) return null;
  if (!staffWalkableCell(world, sx, sy)) return null;
  const startIdx = sy * cols + sx;

  // Standing on a goal already.
  if (goalCells.has(startIdx)) {
    return {
      target: goalCells.get(startIdx)!,
      goalCell: { x: sx, y: sy },
      path: [{ x: sx, y: sy }],
    };
  }

  const visited = new Uint8Array(cols * rows);
  const parent = new Int32Array(cols * rows).fill(-1);
  const queue: number[] = [];
  visited[startIdx] = 1;
  queue.push(startIdx);

  let head = 0;
  let endIdx = -1;
  outer: while (head < queue.length) {
    const idx = queue[head++]!;
    const cx = idx % cols;
    const cy = (idx / cols) | 0;
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
      if (goalCells.has(nidx)) {
        endIdx = nidx;
        break outer;
      }
      queue.push(nidx);
    }
  }

  if (endIdx < 0) return null;

  const path: { x: number; y: number }[] = [];
  let cur = endIdx;
  while (cur !== startIdx) {
    path.push({ x: cur % cols, y: (cur / cols) | 0 });
    cur = parent[cur]!;
  }
  path.push({ x: sx, y: sy });
  path.reverse();
  const gx = endIdx % cols;
  const gy = (endIdx / cols) | 0;
  return { target: goalCells.get(endIdx)!, goalCell: { x: gx, y: gy }, path };
}

// Inclusive cell bounding box of a ranger station's service area, clamped to
// world bounds. Used both by ranger task selection and by the hover overlay.
export function stationServiceBounds(
  station: Building,
  range: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const { cols, rows } = config.grid;
  return {
    minX: Math.max(0, station.x - range),
    maxX: Math.min(cols - 1, station.x + station.width - 1 + range),
    minY: Math.max(0, station.y - range),
    maxY: Math.min(rows - 1, station.y + station.height - 1 + range),
  };
}

export function isInStationRange(
  station: Building,
  range: number,
  cx: number,
  cy: number,
): boolean {
  const b = stationServiceBounds(station, range);
  return cx >= b.minX && cx <= b.maxX && cy >= b.minY && cy <= b.maxY;
}
