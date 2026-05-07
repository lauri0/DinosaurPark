export interface Species {
  id: string;
  displayName: string;
  color: string;
  portraitPath: string;
  spaceNeeded: number;
  eatAmount: number;
  satiationDropRate: number;
  baseSpeed: number;
  wanderFreq: number;
  diet: 'herbivore' | 'carnivore';
  coexistsWith: string[];
  // Probability (0–1) of leaving a poop on the cell when finishing a wander leg.
  poopChance: number;
}

export const SPECIES: Species[] = [
  {
    id: 'allosaurus',
    displayName: 'Allosaurus',
    color: '#C0392B',
    portraitPath: '/assets/portraits/allosaurus.png',
    spaceNeeded: 12,
    eatAmount: 40,
    satiationDropRate: 0.15,
    baseSpeed: 24,
    wanderFreq: 6,
    diet: 'carnivore',
    coexistsWith: ['utahraptor'],
    poopChance: 0.15,
  },
  {
    id: 'stegosaurus',
    displayName: 'Stegosaurus',
    color: '#2E86AB',
    portraitPath: '/assets/portraits/stegosaurus.png',
    spaceNeeded: 10,
    eatAmount: 50,
    satiationDropRate: 0.10,
    baseSpeed: 18,
    wanderFreq: 8,
    diet: 'herbivore',
    coexistsWith: [],
    poopChance: 0.10,
  },
  {
    id: 'utahraptor',
    displayName: 'Utahraptor',
    color: '#E67E22',
    portraitPath: '/assets/portraits/utahraptor.png',
    spaceNeeded: 6,
    eatAmount: 25,
    satiationDropRate: 0.20,
    baseSpeed: 32,
    wanderFreq: 4,
    diet: 'carnivore',
    coexistsWith: ['allosaurus'],
    poopChance: 0.12,
  },
];

const speciesById = new Map(SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): Species {
  const s = speciesById.get(id);
  if (!s) throw new Error(`Unknown species: ${id}`);
  return s;
}

export function tryGetSpecies(id: string): Species | undefined {
  return speciesById.get(id);
}
