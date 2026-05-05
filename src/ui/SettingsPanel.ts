import { emit, on, Events } from '../EventBus';
import type { World } from '../sim/World';
import { saveWorld } from '../sim/Save';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;

export function mountSettingsPanel(getWorld: () => World): void {
  on('open-settings', () => render(getWorld()));
}

function render(world: World): void {
  if (panel && document.body.contains(panel)) {
    closePanel();
    panel = null;
    return;
  }
  panel = makePanel('Settings');
  const body = panel.querySelector('[data-body]') as HTMLElement;

  // Save / load / new game.
  const saveBtn = document.createElement('button');
  saveBtn.className = 'success';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    saveWorld(world);
    emit(Events.SaveRequested, null);
    world.log('Game saved.');
  });

  const loadBtn = document.createElement('button');
  loadBtn.textContent = 'Load Save';
  loadBtn.addEventListener('click', () => {
    if (confirm('Load saved game? Current progress will be lost.')) {
      emit(Events.LoadRequested, null);
    }
  });

  const newBtn = document.createElement('button');
  newBtn.className = 'danger';
  newBtn.textContent = 'New Game';
  newBtn.addEventListener('click', () => {
    if (confirm('Start a new game? Current progress will be lost.')) {
      emit(Events.NewGameRequested, null);
    }
  });

  body.appendChild(saveBtn);
  body.appendChild(loadBtn);
  body.appendChild(newBtn);

  openPanel(panel);
}
