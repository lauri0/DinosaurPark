import type { Quality } from './config';

export interface DigSiteDef {
  id: string;
  name: string;
  region: string;
  initialQuality: Quality;
  species: string[];
  expeditionDurationTicks: number;
  teamCost: number;
}

// 1 unlocked at start (the first one). 8 locked, with escalating unlock costs.
// Species spread so each of the 3 species is reachable from at least one early site.
export const DIG_SITES: DigSiteDef[] = [
  {
    id: 'morrison-flats',
    name: 'Morrison Flats',
    region: 'Colorado',
    initialQuality: 'Good',
    species: ['allosaurus', 'stegosaurus'],
    expeditionDurationTicks: 30,
    teamCost: 500,
  },
  {
    id: 'cedar-mountain',
    name: 'Cedar Mountain',
    region: 'Utah',
    initialQuality: 'Excellent',
    species: ['utahraptor', 'allosaurus'],
    expeditionDurationTicks: 40,
    teamCost: 800,
  },
  {
    id: 'red-bluffs',
    name: 'Red Bluffs',
    region: 'Wyoming',
    initialQuality: 'Good',
    species: ['stegosaurus', 'utahraptor'],
    expeditionDurationTicks: 35,
    teamCost: 700,
  },
  {
    id: 'tendaguru-coast',
    name: 'Tendaguru Coast',
    region: 'Tanzania',
    initialQuality: 'Excellent',
    species: ['stegosaurus', 'allosaurus'],
    expeditionDurationTicks: 50,
    teamCost: 1200,
  },
  {
    id: 'gobi-basin',
    name: 'Gobi Basin',
    region: 'Mongolia',
    initialQuality: 'Fair',
    species: ['utahraptor'],
    expeditionDurationTicks: 45,
    teamCost: 1000,
  },
  {
    id: 'hell-creek',
    name: 'Hell Creek',
    region: 'Montana',
    initialQuality: 'Excellent',
    species: ['allosaurus', 'utahraptor', 'stegosaurus'],
    expeditionDurationTicks: 60,
    teamCost: 2000,
  },
  {
    id: 'isle-of-wight',
    name: 'Isle of Wight',
    region: 'England',
    initialQuality: 'Good',
    species: ['allosaurus'],
    expeditionDurationTicks: 40,
    teamCost: 1500,
  },
  {
    id: 'patagonia-ridge',
    name: 'Patagonia Ridge',
    region: 'Argentina',
    initialQuality: 'Fair',
    species: ['stegosaurus'],
    expeditionDurationTicks: 55,
    teamCost: 1800,
  },
  {
    id: 'lourinha-quarry',
    name: 'Lourinhã Quarry',
    region: 'Portugal',
    initialQuality: 'Good',
    species: ['allosaurus', 'stegosaurus'],
    expeditionDurationTicks: 45,
    teamCost: 1500,
  },
];
