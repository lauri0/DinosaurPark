import { config } from '../data/config';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import { getFacilityDef } from '../data/facilities';
import type {
  ActiveExpedition,
  Building,
  Cell,
  DigSiteState,
  Dino,
  Enclosure,
  FenceEdgeKey,
  HatchInProgress,
  NotificationEntry,
  PendingHatchling,
  PendingHaul,
  Ranger,
  Visitor,
} from './types';
import { DIG_SITES } from '../data/digSites';
import { RNG } from './rng';

export class World {
  cells: Cell[][];
  fenceEdges: Set<FenceEdgeKey> = new Set();
  gateEdges: Set<FenceEdgeKey> = new Set();
  buildings: Map<string, Building> = new Map();
  enclosures: Map<string, Enclosure> = new Map();
  dinos: Map<string, Dino> = new Map();
  rangers: Map<string, Ranger> = new Map();
  visitors: Map<string, Visitor> = new Map();

  digSites: Map<string, DigSiteState> = new Map();
  activeExpedition: ActiveExpedition | null = null;
  pendingHaul: PendingHaul | null = null;

  dna: Record<string, number> = {};
  // Per-species running counter — never decreases. Used to name newly placed dinos
  // (e.g. "Allosaurus 3" even if Allosaurus 1 and 2 are gone).
  nextDinoNumber: Record<string, number> = {};
  // Running counter for visitor names (e.g. "Guest 257"). Never decreases.
  nextVisitorNumber: number = 0;
  // Per-building-type counter for naming facilities (e.g., "Drink Stand 3"). Never decreases.
  nextFacilityNumber: Partial<Record<BuildingType, number>> = {};
  // Tick at which the most recent monthly upkeep was billed (0 = never).
  lastUpkeepBilledAtTick: number = 0;
  admissionRevenueTotal: number = 0;
  admissionRevenueThisMonth: number = 0;
  admissionRevenueLastMonth: number = 0;
  pendingHatchlings: PendingHatchling[] = [];
  hatchInProgress: HatchInProgress[] = [];
  carryHatchlingId: string | null = null;

  cash: number = config.economy.startingCash;
  admissionPrice: number = config.economy.admissionDefault;
  tick = 0;
  timeSpeed: 0 | 1 | 2 | 3 = 1;
  notifications: NotificationEntry[] = [];

  rng: RNG;
  private idCounter = 0;

  constructor(seed: number = Date.now() % 2_147_483_647) {
    this.rng = new RNG(seed);
    this.cells = makeEmptyGrid();
    for (const s of DIG_SITES) {
      this.digSites.set(s.id, {
        id: s.id,
        unlocked: s.id === DIG_SITES[0]!.id,
        quality: s.initialQuality,
      });
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < config.grid.cols && y < config.grid.rows;
  }

  cell(x: number, y: number): Cell | null {
    if (!this.inBounds(x, y)) return null;
    return this.cells[y]![x]!;
  }

  // ---- IDs ----
  newId(prefix: string): string {
    return `${prefix}_${++this.idCounter}_${Math.floor(this.rng.next() * 1e6)}`;
  }

  // ---- Fence edge helpers (canonical: only N and E) ----
  static edgeKey(x: number, y: number, side: 'N' | 'E' | 'S' | 'W'): FenceEdgeKey {
    if (side === 'S') return `${x},${y + 1},N`;
    if (side === 'W') return `${x - 1},${y},E`;
    return `${x},${y},${side}`;
  }

  hasFence(x: number, y: number, side: 'N' | 'E' | 'S' | 'W'): boolean {
    const k = World.edgeKey(x, y, side);
    return this.fenceEdges.has(k) || this.gateEdges.has(k);
  }
  hasGate(x: number, y: number, side: 'N' | 'E' | 'S' | 'W'): boolean {
    return this.gateEdges.has(World.edgeKey(x, y, side));
  }

  // For pathfinding etc: edge that *blocks* movement (fence yes, gate no).
  isEdgeBlocked(x: number, y: number, side: 'N' | 'E' | 'S' | 'W'): boolean {
    const k = World.edgeKey(x, y, side);
    return this.fenceEdges.has(k);
  }

  toggleFence(edgeKey: FenceEdgeKey, on: boolean): void {
    if (on) {
      this.gateEdges.delete(edgeKey);
      this.fenceEdges.add(edgeKey);
    } else {
      this.fenceEdges.delete(edgeKey);
    }
  }
  toggleGate(edgeKey: FenceEdgeKey, on: boolean): void {
    if (on) {
      this.fenceEdges.delete(edgeKey);
      this.gateEdges.add(edgeKey);
    } else {
      this.gateEdges.delete(edgeKey);
    }
  }

  // ---- Path / Building ----
  togglePath(x: number, y: number, on: boolean): void {
    const c = this.cell(x, y);
    if (!c) return;
    if (on && c.buildingId) return;
    c.isPath = on;
  }

  canPlaceBuilding(type: BuildingType, x: number, y: number): boolean {
    const def = BUILDINGS[type];
    for (let dy = 0; dy < def.height; dy++) {
      for (let dx = 0; dx < def.width; dx++) {
        const cx = x + dx, cy = y + dy;
        const c = this.cell(cx, cy);
        if (!c) return false;
        if (c.buildingId) return false;
        if (c.isPath) return false;
      }
    }
    if (type === 'EntranceGate') {
      const def2 = BUILDINGS.EntranceGate;
      const onTopEdge = y === 0;
      const onBottomEdge = y + def2.height === config.grid.rows;
      const onLeftEdge = x === 0;
      const onRightEdge = x + def2.width === config.grid.cols;
      if (!(onTopEdge || onBottomEdge || onLeftEdge || onRightEdge)) return false;
      for (const b of this.buildings.values()) {
        if (b.type === 'EntranceGate') return false;
      }
    }
    return true;
  }

  placeBuilding(type: BuildingType, x: number, y: number): Building | null {
    if (!this.canPlaceBuilding(type, x, y)) return null;
    const def = BUILDINGS[type];
    const id = this.newId(`b_${type}`);
    const b: Building = {
      id,
      type,
      x,
      y,
      width: def.width,
      height: def.height,
      food: type === 'Feeder' ? config.feeder.capacity : undefined,
    };
    const facilityDef = getFacilityDef(type);
    if (facilityDef) {
      const num = (this.nextFacilityNumber[type] ?? 0) + 1;
      this.nextFacilityNumber[type] = num;
      b.facility = {
        number: num,
        builtAtTick: this.tick,
        priceTier: facilityDef.defaultPriceTier,
        revenueTotal: 0,
        upkeepPaidTotal: 0,
        revenueThisMonth: 0,
        revenueLastMonth: 0,
        upkeepLastMonth: 0,
      };
    }
    this.buildings.set(id, b);
    for (let dy = 0; dy < def.height; dy++) {
      for (let dx = 0; dx < def.width; dx++) {
        const c = this.cells[y + dy]![x + dx]!;
        c.buildingId = id;
      }
    }
    return b;
  }

  removeBuilding(id: string): void {
    const b = this.buildings.get(id);
    if (!b) return;
    for (let dy = 0; dy < b.height; dy++) {
      for (let dx = 0; dx < b.width; dx++) {
        const c = this.cells[b.y + dy]?.[b.x + dx];
        if (c) c.buildingId = null;
      }
    }
    this.buildings.delete(id);
  }

  buildingCenterPx(b: Building): { x: number; y: number } {
    const cs = config.grid.cellSize;
    return {
      x: (b.x + b.width / 2) * cs,
      y: (b.y + b.height / 2) * cs,
    };
  }

  buildingAt(x: number, y: number): Building | null {
    const c = this.cell(x, y);
    if (!c || !c.buildingId) return null;
    return this.buildings.get(c.buildingId) ?? null;
  }

  log(msg: string): void {
    this.notifications.push({ tick: this.tick, msg });
    if (this.notifications.length > config.notifications.maxEntries) {
      this.notifications.splice(0, this.notifications.length - config.notifications.maxEntries);
    }
  }
}

function makeEmptyGrid(): Cell[][] {
  const grid: Cell[][] = [];
  for (let y = 0; y < config.grid.rows; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < config.grid.cols; x++) {
      row.push({ buildingId: null, isPath: false, enclosureId: null });
    }
    grid.push(row);
  }
  return grid;
}
