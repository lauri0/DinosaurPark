import type { BuildingType } from './buildings';

export type PriceTier = 'low' | 'medium' | 'high';

export const PRICE_TIERS: PriceTier[] = ['low', 'medium', 'high'];

export const PRICE_TIER_LABEL: Record<PriceTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export interface FacilityDef {
  buildingType: BuildingType;
  // Singular display name used in panels and counters: "Drink Stand 3".
  facilityName: string;
  // Need served — used by visitors AI to find a relevant facility.
  satisfies: 'drink' | 'food' | 'souvenir';
  prices: Record<PriceTier, number>;
  defaultPriceTier: PriceTier;
  upkeepPerMonth: number;
}

// Buildings that are facilities have an entry here. Future stands (pizza, burger,
// gift shop) just add a new key.
export const FACILITIES: Partial<Record<BuildingType, FacilityDef>> = {
  DrinkStand: {
    buildingType: 'DrinkStand',
    facilityName: 'Drink Stand',
    satisfies: 'drink',
    prices: { low: 1, medium: 2, high: 3 },
    defaultPriceTier: 'medium',
    upkeepPerMonth: 20,
  },
};

export function getFacilityDef(type: BuildingType): FacilityDef | null {
  return FACILITIES[type] ?? null;
}

export function isFacilityBuilding(type: BuildingType): boolean {
  return FACILITIES[type] != null;
}
