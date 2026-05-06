import type { BuildingType } from '../data/buildings';
import type { Quality } from '../data/config';

export interface Cell {
  buildingId: string | null;
  isPath: boolean;
  enclosureId: string | null;
}

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  food?: number;
}

export interface Enclosure {
  id: string;
  cells: { x: number; y: number }[];
  speciesId: string | null;
}

export interface Dino {
  id: string;
  speciesId: string;
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

export interface Ranger {
  id: string;
  name: string;
  stationId: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  state: 'idle' | 'walking-to-feeder';
  taskFeederId?: string | null;
  waypoint: { x: number; y: number } | null;
}

export interface Visitor {
  id: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  state: 'arriving' | 'viewing' | 'leaving';
  enclosuresViewed: number;
  path: { x: number; y: number }[];
  pathIdx: number;
  viewIdleRemaining: number;
  targetCell: { x: number; y: number } | null;
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
