export type BuildingType =
  | 'EntranceGate'
  | 'Feeder'
  | 'RangerStation'
  | 'FossilCentre'
  | 'Hatchery'
  | 'DrinkStand';

export interface BuildingDef {
  type: BuildingType;
  displayName: string;
  width: number;
  height: number;
  cost: number;
  glyph: 'gate' | 'flask' | 'cross' | 'bone' | 'egg' | 'cup';
  staffWalkable?: boolean;
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
    cost: 200,
    glyph: 'cross',
    staffWalkable: true,
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
  DrinkStand: {
    type: 'DrinkStand',
    displayName: 'Drink Stand',
    width: 1,
    height: 1,
    cost: 150,
    glyph: 'cup',
  },
};

export function isStaffWalkableBuilding(type: BuildingType): boolean {
  return BUILDINGS[type].staffWalkable === true;
}

export const BUILDING_TYPES: BuildingType[] = [
  'EntranceGate',
  'Feeder',
  'RangerStation',
  'FossilCentre',
  'Hatchery',
  'DrinkStand',
];
