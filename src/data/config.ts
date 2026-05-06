export const config = {
  grid: { cols: 80, rows: 60, cellSize: 32 },
  camera: { minZoom: 0.5, maxZoom: 2.0 },
  time: { tickMs: 1000, dayTicks: 6, speeds: [0, 1, 2, 3] as const },
  economy: {
    startingCash: 10_000,
    admissionDefault: 10,
    admissionMin: 0,
    admissionMax: 50,
    foodCostPerUnit: 0.5,
    rangerWagePerDay: 30,
    valuableSalePrice: 500,
    fossilSalePerDnaPercent: 5,
    digSiteUnlockCosts: [2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000],
  },
  visitors: {
    spawnBase: 60,
    priceFactorMin: 0.1,
    priceFactorSlope: 0.05,
    enclosuresPerVisit: 3,
    viewIdleTicks: 4,
  },
  expedition: {
    qualityToFossilCount: {
      Excellent: 2,
      Good: 2,
      Fair: 1,
      Poor: 1,
      Depleted: 0,
      Exhausted: 0,
    } as Record<Quality, number>,
    qualityToDnaRange: {
      Excellent: [60, 90],
      Good: [40, 70],
      Fair: [25, 55],
      Poor: [10, 35],
      Depleted: [5, 20],
      Exhausted: [0, 0],
    } as Record<Quality, [number, number]>,
    degradeChance: 0.25,
    valuableChance: 0.10,
    dnaCap: 100,
    hatchThreshold: 50,
    hatchTicks: 3,
  },
  dinos: { starvationHealthDrop: 0.5, eatTriggerSatiation: 30 },
  feeder: { capacity: 100, refillThresholdRatio: 0.3 },
  ranger: { maxPerStation: 3 },
  notifications: { maxEntries: 200 },
  colors: {
    grass: '#7FB069',
    void: '#000000',
    grid: 'rgba(0,0,0,0.08)',
    visitor: '#f4ecd8',
    ranger: '#3a3a3a',
    path: '#c8b88c',
    fence: '#3a2a1a',
    gate: '#9a7a3a',
    previewOk: 0x33ff66,
    previewBad: 0xff4444,
    buildings: {
      EntranceGate: '#5a4632',
      Feeder: '#a8743a',
      RangerStation: '#3a4a6a',
      FossilCentre: '#6a4a8a',
      Hatchery: '#8a6a3a',
    } as const,
  },
} as const;

export type Quality =
  | 'Excellent'
  | 'Good'
  | 'Fair'
  | 'Poor'
  | 'Depleted'
  | 'Exhausted';

export const QUALITY_TIERS: readonly Quality[] = [
  'Excellent',
  'Good',
  'Fair',
  'Poor',
  'Depleted',
  'Exhausted',
];

export function degradeQuality(q: Quality): Quality {
  const i = QUALITY_TIERS.indexOf(q);
  if (i === -1 || i === QUALITY_TIERS.length - 1) return q;
  return QUALITY_TIERS[i + 1]!;
}
