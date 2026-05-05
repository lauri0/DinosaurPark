import { config } from '../data/config';
import { recomputeEnclosures } from './Enclosures';
import { invalidateVisitorPathing } from './Visitors';
import type { Building, Dino, Ranger } from './types';
import { World } from './World';

const SAVE_KEY = 'dpb.save.v1';
const SAVE_VERSION = 1;

interface SaveBlob {
  version: number;
  rngState: number;
  tick: number;
  cash: number;
  admissionPrice: number;
  timeSpeed: 0 | 1 | 2 | 3;
  fenceEdges: string[];
  gateEdges: string[];
  paths: string[];
  buildings: Building[];
  enclosureSpecies: { cellsHash: string; speciesId: string }[];
  dinos: Dino[];
  rangers: Ranger[];
  digSites: { id: string; unlocked: boolean; quality: string }[];
  activeExpedition: { siteId: string; finishesAtTick: number } | null;
  pendingHaul: World['pendingHaul'];
  dna: Record<string, number>;
  pendingHatchlings: { id: string; speciesId: string }[];
  hatchInProgress: { hatcheryId: string; speciesId: string; finishesAtTick: number }[];
  notifications: { tick: number; msg: string }[];
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveWorld(world: World): void {
  const paths: string[] = [];
  for (let y = 0; y < config.grid.rows; y++) {
    for (let x = 0; x < config.grid.cols; x++) {
      if (world.cells[y]![x]!.isPath) paths.push(`${x},${y}`);
    }
  }
  const enclosureSpecies: { cellsHash: string; speciesId: string }[] = [];
  for (const e of world.enclosures.values()) {
    if (!e.speciesId) continue;
    const sortedKey = e.cells.map((c) => `${c.x},${c.y}`).sort().join('|');
    enclosureSpecies.push({ cellsHash: sortedKey, speciesId: e.speciesId });
  }
  const blob: SaveBlob = {
    version: SAVE_VERSION,
    rngState: world.rng.getState(),
    tick: world.tick,
    cash: world.cash,
    admissionPrice: world.admissionPrice,
    timeSpeed: world.timeSpeed,
    fenceEdges: Array.from(world.fenceEdges),
    gateEdges: Array.from(world.gateEdges),
    paths,
    buildings: Array.from(world.buildings.values()),
    enclosureSpecies,
    dinos: Array.from(world.dinos.values()),
    rangers: Array.from(world.rangers.values()),
    digSites: Array.from(world.digSites.values()),
    activeExpedition: world.activeExpedition,
    pendingHaul: world.pendingHaul,
    dna: { ...world.dna },
    pendingHatchlings: world.pendingHatchlings.map((h) => ({ ...h })),
    hatchInProgress: world.hatchInProgress.map((h) => ({ ...h })),
    notifications: world.notifications.slice(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
}

export function loadWorld(): World | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  let blob: SaveBlob;
  try {
    blob = JSON.parse(raw) as SaveBlob;
  } catch {
    return null;
  }
  if (blob.version !== SAVE_VERSION) return null;

  const world = new World(1); // seed overwritten below
  world.rng.setState(blob.rngState);
  world.tick = blob.tick;
  world.cash = blob.cash;
  world.admissionPrice = blob.admissionPrice;
  world.timeSpeed = blob.timeSpeed;
  for (const k of blob.fenceEdges) world.fenceEdges.add(k);
  for (const k of blob.gateEdges) world.gateEdges.add(k);
  for (const p of blob.paths) {
    const [xs, ys] = p.split(',');
    const x = Number(xs), y = Number(ys);
    const c = world.cell(x, y);
    if (c) c.isPath = true;
  }
  for (const b of blob.buildings) {
    world.buildings.set(b.id, { ...b });
    for (let dy = 0; dy < b.height; dy++) {
      for (let dx = 0; dx < b.width; dx++) {
        const c = world.cell(b.x + dx, b.y + dy);
        if (c) c.buildingId = b.id;
      }
    }
  }
  for (const d of blob.dinos) world.dinos.set(d.id, { ...d, prevX: d.prevX ?? d.x, prevY: d.prevY ?? d.y });
  for (const r of blob.rangers) world.rangers.set(r.id, { ...r, prevX: r.prevX ?? r.x, prevY: r.prevY ?? r.y });
  for (const s of blob.digSites) {
    world.digSites.set(s.id, {
      id: s.id,
      unlocked: s.unlocked,
      quality: s.quality as never,
    });
  }
  world.activeExpedition = blob.activeExpedition;
  world.pendingHaul = blob.pendingHaul;
  world.dna = { ...blob.dna };
  world.pendingHatchlings = blob.pendingHatchlings.slice();
  world.hatchInProgress = blob.hatchInProgress.slice();
  world.notifications = blob.notifications.slice();

  recomputeEnclosures(world);
  // Re-apply enclosure species by cell-set match.
  for (const stored of blob.enclosureSpecies) {
    for (const e of world.enclosures.values()) {
      const k = e.cells.map((c) => `${c.x},${c.y}`).sort().join('|');
      if (k === stored.cellsHash) {
        e.speciesId = stored.speciesId;
        break;
      }
    }
  }
  invalidateVisitorPathing();
  return world;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
