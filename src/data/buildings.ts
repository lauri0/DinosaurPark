export type BuildingType =
  | 'EntranceGate'
  | 'Feeder'
  | 'RangerStation'
  | 'FossilCentre'
  | 'Hatchery';

export interface BuildingDef {
  type: BuildingType;
  displayName: string;
  width: number;
  height: number;
  cost: number;
  glyph: 'gate' | 'flask' | 'cross' | 'bone' | 'egg';
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  EntranceGate: {
    type: 'EntranceGate',
    displayName: 'Entrance Gate',
    width: 2,
    height: 1,
    cost: 500,
    glyph: 'gate',
  },
  Feeder: {
    type: 'Feeder',
    displayName: 'Feeder',
    width: 1,
    height: 1,
    cost: 100,
    glyph: 'bone',
  },
  RangerStation: {
    type: 'RangerStation',
    displayName: 'Ranger Station',
    width: 2,
    height: 2,
    cost: 800,
    glyph: 'cross',
  },
  FossilCentre: {
    type: 'FossilCentre',
    displayName: 'Fossil Centre',
    width: 2,
    height: 2,
    cost: 1500,
    glyph: 'flask',
  },
  Hatchery: {
    type: 'Hatchery',
    displayName: 'Hatchery',
    width: 3,
    height: 3,
    cost: 2000,
    glyph: 'egg',
  },
};

export const BUILDING_TYPES: BuildingType[] = [
  'EntranceGate',
  'Feeder',
  'RangerStation',
  'FossilCentre',
  'Hatchery',
];
