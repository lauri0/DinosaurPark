import type { BuildingType } from '../data/buildings';
import type { PriceTier } from '../data/facilities';
import type { Quality } from '../data/config';

export interface FacilityState {
  number: number;
  builtAtTick: number;
  priceTier: PriceTier;
  revenueTotal: number;
  upkeepPaidTotal: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  upkeepLastMonth: number;
}

export interface Cell {
  buildingId: string | null;
  isPath: boolean;
  enclosureId: string | null;
  walkableForStaff: boolean;
}

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  food?: number;
  facility?: FacilityState;
}

export interface Enclosure {
  id: string;
  cells: { x: number; y: number }[];
  speciesId: string | null;
}

export interface Dino {
  id: string;
  speciesId: string;
  name: string;
  birthTick: number;
  enclosureId: string | null;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  satiation: number;
  health: number;
  dnaPercentAtHatch: number;
  waypoint: { x: number; y: number } | null;
  nextWanderAt: number;
  eatingFeederId?: string | null;
}

export interface Poop {
  id: string;
  x: number;
  y: number;
  enclosureId: string;
  spawnedAtTick: number;
}

export interface Ranger {
  id: string;
  name: string;
  stationId: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  state: 'idle' | 'walking-to-feeder' | 'walking-to-poop' | 'cleaning-poop' | 'wandering' | 'returning-to-station' | 'stranded';
  taskFeederId?: string | null;
  taskPoopId?: string | null;
  cleanTicksRemaining?: number;
  path: { x: number; y: number }[];
  pathIdx: number;
  goalCell: { x: number; y: number } | null;
  pathEpoch: number;
}

export interface Visitor {
  id: string;
  name: string;
  arrivedAtTick: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  state: 'arriving' | 'viewing' | 'leaving' | 'going-to-drink' | 'drinking';
  enclosuresViewed: number;
  path: { x: number; y: number }[];
  pathIdx: number;
  viewIdleRemaining: number;
  targetCell: { x: number; y: number } | null;
  drink: number;
  targetDrinkStandId: string | null;
}

export interface DigSiteState {
  id: string;
  unlocked: boolean;
  quality: Quality;
}

export interface ActiveExpedition {
  siteId: string;
  finishesAtTick: number;
}

export interface FossilHaul {
  id: string;
  siteId: string;
  speciesId: string;
  dnaPercent: number;
}

export interface PendingHaul {
  siteId: string;
  fossils: FossilHaul[];
  valuables: number;
  decided: Record<string, 'extract' | 'sell' | null>;
}

export interface PendingHatchling {
  id: string;
  speciesId: string;
}

export interface HatchInProgress {
  hatcheryId: string;
  speciesId: string;
  finishesAtTick: number;
}

export interface NotificationEntry {
  tick: number;
  msg: string;
}

export type FenceEdgeKey = string; // "x,y,N" or "x,y,E"

export type BuildMode =
  | 'cursor'
  | 'path'
  | 'fence'
  | 'gate'
  | `building:${BuildingType}`
  | 'carry'
  | 'bulldoze';
