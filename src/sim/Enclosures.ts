import { config } from '../data/config';
import type { Enclosure } from './types';
import { World } from './World';

// Recompute enclosures by flood-filling from cells adjacent to gates.
// A region is an enclosure only if its fill is bounded (does not reach the map edge boundary
// without crossing a fence/gate).
//
// Approach:
//   - Build a connectivity over cells where movement (cell -> neighbour) is allowed unless
//     the shared edge is a fence (gates count as walls for the *map* connectivity to outside,
//     but to identify the inside region we use them as portals from outside-known seed).
//   - Easier formulation: any closed region of cells is bounded by walls on every cell-edge
//     where it has no neighbour in the region. To be a real enclosure, every cell-edge on
//     the boundary of the region must be either a fence OR a gate OR the map edge.
//   - Identify connected components where movement is blocked by fences AND gates (treating
//     gate as wall). For each component, check if it touches the map edge. If not, it is an
//     enclosure.
export function recomputeEnclosures(world: World): void {
  const cols = config.grid.cols;
  const rows = config.grid.rows;
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  // Save prior assignment for stable IDs by overlap.
  const priorEnclosures = Array.from(world.enclosures.values()).map((e) => ({
    id: e.id,
    speciesId: e.speciesId,
    cellSet: new Set(e.cells.map((c) => `${c.x},${c.y}`)),
  }));

  // Clear current assignments.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      world.cells[y]![x]!.enclosureId = null;
    }
  }
  world.enclosures.clear();

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (visited[y]![x]) continue;
      // Flood fill from (x,y) treating fence AND gate as walls.
      const cells: { x: number; y: number }[] = [];
      const queue: [number, number][] = [[x, y]];
      visited[y]![x] = true;
      let touchesMapEdge = false;

      while (queue.length) {
        const [cx, cy] = queue.shift()!;
        cells.push({ x: cx, y: cy });
        // Map edge contact: this cell is on the world boundary AND has no fence/gate
        // separating it from "outside" — i.e. in a flood-fill view, the cell itself is on
        // the edge. In our model the world boundary always counts as a wall for visitors,
        // but for enclosure-detection a region that includes a map-edge cell is "outside".
        if (cx === 0 || cy === 0 || cx === cols - 1 || cy === rows - 1) {
          touchesMapEdge = true;
        }
        // Try 4 neighbours.
        const tryStep = (nx: number, ny: number, side: 'N' | 'E' | 'S' | 'W') => {
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
          if (visited[ny]![nx]) return;
          // Blocked by fence or gate (gate is also a wall for the inside-region notion).
          if (world.hasFence(cx, cy, side)) return;
          visited[ny]![nx] = true;
          queue.push([nx, ny]);
        };
        tryStep(cx, cy - 1, 'N');
        tryStep(cx + 1, cy, 'E');
        tryStep(cx, cy + 1, 'S');
        tryStep(cx - 1, cy, 'W');
      }

      if (touchesMapEdge) continue; // outside region, skip
      if (cells.length === 0) continue;

      // Bounded region — it's an enclosure. Match a prior species via overlap.
      const cellSet = new Set(cells.map((c) => `${c.x},${c.y}`));
      let bestPrior: { id: string; speciesId: string | null; overlap: number } | null = null;
      for (const p of priorEnclosures) {
        let overlap = 0;
        for (const k of cellSet) if (p.cellSet.has(k)) overlap++;
        if (!bestPrior || overlap > bestPrior.overlap) {
          bestPrior = { id: p.id, speciesId: p.speciesId, overlap };
        }
      }

      const id =
        bestPrior && bestPrior.overlap * 2 > Math.min(cellSet.size, priorEnclosures.length ? Math.max(...priorEnclosures.map((p) => p.cellSet.size)) : Number.MAX_VALUE)
          ? bestPrior.id
          : `enc_${cells[0]!.x}_${cells[0]!.y}_${cells.length}_${world.tick}`;

      const enc: Enclosure = {
        id,
        cells,
        speciesId: bestPrior && bestPrior.id === id ? bestPrior.speciesId : null,
      };
      world.enclosures.set(id, enc);
      for (const c of cells) {
        world.cells[c.y]![c.x]!.enclosureId = id;
      }
    }
  }

  // Reassign each dino to its enclosure based on its current cell (if any).
  for (const d of world.dinos.values()) {
    if (d.enclosureId === null) continue; // carried
    const cs = config.grid.cellSize;
    const cx = Math.floor(d.x / cs);
    const cy = Math.floor(d.y / cs);
    const c = world.cell(cx, cy);
    d.enclosureId = c?.enclosureId ?? null;
  }
}

export function enclosureBounds(enc: Enclosure): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of enc.cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, minY, maxX, maxY };
}

export function enclosureCentroid(enc: Enclosure): { x: number; y: number } {
  let sx = 0, sy = 0;
  for (const c of enc.cells) {
    sx += c.x;
    sy += c.y;
  }
  return { x: sx / enc.cells.length, y: sy / enc.cells.length };
}
