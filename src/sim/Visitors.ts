import EasyStar from 'easystarjs';
import { emit, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from './World';
import { changeCash } from './Economy';
import type { Visitor } from './types';

let nextSpawnAt = 30; // first visitor possibility
let easystar: EasyStar.js | null = null;

function buildEasystar(world: World): EasyStar.js {
  const cols = config.grid.cols;
  const rows = config.grid.rows;
  const grid: number[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < cols; x++) {
      row.push(walkableForVisitor(world, x, y) ? 0 : 1);
    }
    grid.push(row);
  }
  const es = new EasyStar.js();
  es.setGrid(grid);
  es.setAcceptableTiles([0]);
  es.disableDiagonals();
  return es;
}

function walkableForVisitor(world: World, x: number, y: number): boolean {
  const c = world.cell(x, y);
  if (!c) return false;
  if (c.buildingId) {
    const b = world.buildings.get(c.buildingId);
    if (b?.type === 'EntranceGate') return true;
    return false;
  }
  if (c.isPath) return true;
  // Viewing cells: cells within 2 of an enclosure (and not in one).
  if (c.enclosureId) return false;
  if (isViewingCell(world, x, y)) return true;
  return false;
}

function isViewingCell(world: World, x: number, y: number): boolean {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const c = world.cell(x + dx, y + dy);
      if (c?.enclosureId) return true;
    }
  }
  return false;
}

export function invalidateVisitorPathing(): void {
  easystar = null;
}

function findEntranceGate(world: World) {
  for (const b of world.buildings.values()) {
    if (b.type === 'EntranceGate') return b;
  }
  return null;
}

function dinoCount(world: World): number {
  return world.dinos.size;
}

function spawnIntervalTicks(world: World): number {
  const dinos = dinoCount(world);
  if (dinos === 0) return Infinity;
  const priceFactor = Math.max(0.1, 2 - world.admissionPrice / 20);
  return Math.max(4, Math.min(600, Math.round(60 / (dinos * priceFactor))));
}

export function tickVisitors(world: World): void {
  const cs = config.grid.cellSize;
  const gate = findEntranceGate(world);

  // Step each visitor first, so newly spawned visitors are only processed next tick.
  const toRemove: string[] = [];
  for (const v of world.visitors.values()) {
    if (v.path.length === 0 || v.pathIdx >= v.path.length) {
      // Decide next action.
      if (v.state === 'arriving') {
        v.state = 'viewing';
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
          // Pick another viewing cell.
          if (!planVisitorTo(world, v, pickViewingTarget(world))) {
            v.state = 'leaving';
          } else {
            v.viewIdleRemaining = config.visitors.viewIdleTicks;
            continue;
          }
        }
      }
      if (v.state === 'leaving') {
        if (gate) {
          if (!planVisitorTo(world, v, { x: gate.x, y: gate.y })) {
            toRemove.push(v.id);
            continue;
          }
        } else {
          toRemove.push(v.id);
          continue;
        }
        v.state = 'leaving';
        // Once on path to leave, despawn when reached end.
        if (v.path.length === 0) {
          toRemove.push(v.id);
          continue;
        }
        // Mark a sentinel: once we reach the gate cell, despawn.
        v.viewIdleRemaining = 0;
      }
    }

    // Move along path.
    const node = v.path[v.pathIdx];
    if (!node) {
      if (v.state === 'leaving') toRemove.push(v.id);
      continue;
    }
    const tx = (node.x + 0.5) * cs;
    const ty = (node.y + 0.5) * cs;
    const dx = tx - v.x;
    const dy = ty - v.y;
    const dist = Math.hypot(dx, dy);
    const stepPx = 22 * (config.time.tickMs / 1000);
    if (dist < stepPx) {
      v.x = tx;
      v.y = ty;
      v.pathIdx++;
    } else {
      v.x += (dx / dist) * stepPx;
      v.y += (dy / dist) * stepPx;
    }
  }
  if (toRemove.length > 0) {
    console.log('[Visitors] removing', toRemove.length, 'visitors. Remaining after:', world.visitors.size - toRemove.length);
  }
  for (const id of toRemove) world.visitors.delete(id);

  // Spawn cadence — after movement so new visitors are processed on the next tick.
  if (gate && dinoCount(world) > 0) {
    if (world.tick >= nextSpawnAt) {
      spawnVisitor(world, gate);
      nextSpawnAt = world.tick + spawnIntervalTicks(world);
    }
  } else {
    nextSpawnAt = world.tick + 30;
  }
}

function spawnVisitor(world: World, gate: { x: number; y: number }): void {
  const cs = config.grid.cellSize;
  const spawnX = (gate.x + 0.5) * cs;
  const spawnY = (gate.y + 0.5) * cs;
  const v: Visitor = {
    id: world.newId('visitor'),
    x: spawnX,
    y: spawnY,
    prevX: spawnX,
    prevY: spawnY,
    state: 'arriving',
    enclosuresViewed: 0,
    path: [],
    pathIdx: 0,
    viewIdleRemaining: 3,
  };
  world.visitors.set(v.id, v);
  changeCash(world, world.admissionPrice, 'admission');
  const target = pickViewingTarget(world);
  const planned = target ? planVisitorTo(world, v, target) : false;
  console.log('[Visitors] spawn', { id: v.id, at: { x: spawnX, y: spawnY }, gateCell: { x: gate.x, y: gate.y }, target, planned, pathLen: v.path.length, total: world.visitors.size });
}

function pickViewingTarget(world: World): { x: number; y: number } | null {
  const candidates: { x: number; y: number }[] = [];
  for (let y = 0; y < config.grid.rows; y++) {
    for (let x = 0; x < config.grid.cols; x++) {
      const c = world.cell(x, y);
      if (!c) continue;
      if (c.enclosureId) continue;
      if (c.buildingId) continue;
      if (!isViewingCell(world, x, y)) continue;
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return null;
  return world.rng.pick(candidates);
}

function planVisitorTo(
  world: World,
  v: Visitor,
  target: { x: number; y: number } | null,
): boolean {
  if (!target) return false;
  if (!easystar) easystar = buildEasystar(world);
  const cs = config.grid.cellSize;
  const sx = Math.floor(v.x / cs);
  const sy = Math.floor(v.y / cs);
  let resolved = false;
  let path: { x: number; y: number }[] | null = null;
  easystar.findPath(sx, sy, target.x, target.y, (p) => {
    path = p;
    resolved = true;
  });
  // Iterate until the search completes. easystar processes a fixed number of nodes per
  // calculate(); for an 80x60 grid we cap at ~5000 iterations to avoid infinite loops.
  for (let i = 0; i < 5000 && !resolved; i++) {
    easystar.calculate();
  }
  if (!resolved) return false;
  if (!path) return false;
  v.path = path as { x: number; y: number }[];
  v.pathIdx = 0;
  return v.path.length > 0;
}
