import { emit, on, Events } from '../EventBus';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import type { BuildMode } from '../sim/types';

const MODES: { mode: BuildMode; label: string }[] = [
  { mode: 'cursor', label: '↖' },
  { mode: 'bulldoze', label: '🔨' },
  { mode: 'path', label: 'Path' },
  { mode: 'fence', label: 'Fence' },
  { mode: 'gate', label: 'Gate' },
  ...(['EntranceGate', 'Feeder', 'RangerStation', 'FossilCentre', 'Hatchery', 'DrinkStand'] as BuildingType[]).map((t) => ({
    mode: `building:${t}` as BuildMode,
    label: BUILDINGS[t].displayName,
  })),
];

export function mountBuildPalette(): void {
  const root = document.getElementById('ui-root')!;
  const div = document.createElement('div');
  div.className = 'toolbar';
  for (const m of MODES) {
    const b = document.createElement('button');
    b.dataset.mode = m.mode;
    b.textContent = m.label;
    b.title = m.label;
    b.addEventListener('click', () => {
      emit(Events.BuildModeChanged, { mode: m.mode });
    });
    div.appendChild(b);
  }
  root.appendChild(div);
  const setActive = (mode: BuildMode) => {
    for (const b of div.querySelectorAll('button')) {
      b.classList.toggle('active', (b as HTMLButtonElement).dataset.mode === mode);
    }
  };
  setActive('cursor');
  on<{ mode: BuildMode }>(Events.BuildModeChanged, ({ mode }) => setActive(mode));
}
