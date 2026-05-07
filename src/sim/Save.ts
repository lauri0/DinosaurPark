import { config } from '../data/config';
import { getSpecies } from '../data/species';
import { getFacilityDef } from '../data/facilities';
import type { BuildingType } from '../data/buildings';
import { recomputeEnclosures } from './Enclosures';
import { invalidateVisitorPathing, getNextSpawnAt, setNextSpawnAt } from './Visitors';
import type { Building, Dino, Poop, Ranger, Visitor } from './types';
import { World, poopCellKey } from './World';

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
  visitors: Visitor[];
  poops?: Poop[];
  nextVisitorSpawnAt: number;
  digSites: { id: string; unlocked: boolean; quality: string }[];
  activeExpedition: { siteId: string; finishesAtTick: number } | null;
  pendingHaul: World['pendingHaul'];
  dna: Record<string, number>;
  nextDinoNumber: Record<string, number>;
  nextVisitorNumber?: number;
  nextFacilityNumber?: Partial<Record<BuildingType, number>>;
  lastUpkeepBilledAtTick?: number;
  admissionRevenueTotal?: number;
  admissionRevenueThisMonth?: number;
  admissionRevenueLastMonth?: number;
  pendingHatchlings: { id: string; speciesId: string; sex?: 'male' | 'female' }[];
  hatchInProgress: { hatcheryId: string; speciesId: string; sex?: 'male' | 'female'; finishesAtTick: number }[];
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
    visitors: Array.from(world.visitors.values()),
    poops: Array.from(world.poops.values()),
    nextVisitorSpawnAt: getNextSpawnAt(),
    digSites: Array.from(world.digSites.values()),
    activeExpedition: world.activeExpedition,
    pendingHaul: world.pendingHaul,
    dna: { ...world.dna },
    nextDinoNumber: { ...world.nextDinoNumber },
    nextVisitorNumber: world.nextVisitorNumber,
    nextFacilityNumber: { ...world.nextFacilityNumber },
    lastUpkeepBilledAtTick: world.lastUpkeepBilledAtTick,
    admissionRevenueTotal: world.admissionRevenueTotal,
    admissionRevenueThisMonth: world.admissionRevenueThisMonth,
    admissionRevenueLastMonth: world.admissionRevenueLastMonth,
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
  if (blob.nextFacilityNumber) world.nextFacilityNumber = { ...blob.nextFacilityNumber };
  world.lastUpkeepBilledAtTick = blob.lastUpkeepBilledAtTick ?? blob.tick;
  world.admissionRevenueTotal = blob.admissionRevenueTotal ?? 0;
  world.admissionRevenueThisMonth = blob.admissionRevenueThisMonth ?? 0;
  world.admissionRevenueLastMonth = blob.admissionRevenueLastMonth ?? 0;
  for (const b of blob.buildings) {
    const copy = { ...b };
    const def = getFacilityDef(b.type);
    if (def) {
      if (!copy.facility) {
        const num = (world.nextFacilityNumber[b.type] ?? 0) + 1;
        world.nextFacilityNumber[b.type] = num;
        copy.facility = {
          number: num,
          builtAtTick: blob.tick,
          priceTier: def.defaultPriceTier,
          revenueTotal: 0,
          upkeepPaidTotal: 0,
          revenueThisMonth: 0,
          revenueLastMonth: 0,
          upkeepLastMonth: 0,
        };
      } else {
        copy.facility = {
          number: copy.facility.number,
          builtAtTick: copy.facility.builtAtTick,
          priceTier: copy.facility.priceTier,
          revenueTotal: copy.facility.revenueTotal ?? 0,
          upkeepPaidTotal: copy.facility.upkeepPaidTotal ?? 0,
          revenueThisMonth: copy.facility.revenueThisMonth ?? 0,
          revenueLastMonth: copy.facility.revenueLastMonth ?? 0,
          upkeepLastMonth: copy.facility.upkeepLastMonth ?? 0,
        };
      }
    }
    world.buildings.set(b.id, copy);
    for (let dy = 0; dy < b.height; dy++) {
      for (let dx = 0; dx < b.width; dx++) {
        const c = world.cell(b.x + dx, b.y + dy);
        if (c) c.buildingId = b.id;
      }
    }
  }
  if (blob.nextDinoNumber) world.nextDinoNumber = { ...blob.nextDinoNumber };
  for (const d of blob.dinos) {
    let name = d.name;
    if (!name) {
      const num = (world.nextDinoNumber[d.speciesId] ?? 0) + 1;
      world.nextDinoNumber[d.speciesId] = num;
      name = `${getSpecies(d.speciesId).displayName} ${num}`;
    }
    world.dinos.set(d.id, {
      ...d,
      name,
      birthTick: d.birthTick ?? 0,
      prevX: d.prevX ?? d.x,
      prevY: d.prevY ?? d.y,
      sex: d.sex ?? 'female',
    });
  }
  for (const r of blob.rangers) {
    world.rangers.set(r.id, {
      ...r,
      prevX: r.prevX ?? r.x,
      prevY: r.prevY ?? r.y,
      taskFeederId: r.taskFeederId ?? null,
      taskPoopId: r.taskPoopId ?? null,
      path: r.path ?? [],
      pathIdx: r.pathIdx ?? 0,
      goalCell: r.goalCell ?? null,
      // Force re-plan against freshly-recomputed walkability.
      pathEpoch: -1,
    });
  }
  for (const p of blob.poops ?? []) {
    world.poops.set(p.id, { ...p });
    world.poopByCell.set(poopCellKey(p.x, p.y), p.id);
  }
  if (typeof blob.nextVisitorNumber === 'number') world.nextVisitorNumber = blob.nextVisitorNumber;
  for (const v of (blob.visitors ?? [])) {
    let name = v.name;
    if (!name) {
      const num = world.nextVisitorNumber + 1;
      world.nextVisitorNumber = num;
      name = `Guest ${num}`;
    }
    world.visitors.set(v.id, {
      ...v,
      name,
      arrivedAtTick: v.arrivedAtTick ?? blob.tick,
      prevX: v.prevX ?? v.x,
      prevY: v.prevY ?? v.y,
      targetCell: v.targetCell ?? null,
      drink: v.drink ?? config.visitors.drinkMax,
      targetDrinkStandId: v.targetDrinkStandId ?? null,
    });
  }
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
  world.pendingHatchlings = blob.pendingHatchlings.map((h) => ({ ...h, sex: h.sex ?? 'female' }));
  world.hatchInProgress = blob.hatchInProgress.map((h) => ({ ...h, sex: h.sex ?? 'female' }));
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
  setNextSpawnAt(blob.nextVisitorSpawnAt ?? blob.tick + 30);
  return world;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
