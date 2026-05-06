import { on, Events } from '../EventBus';
import { config } from '../data/config';
import { getSpecies } from '../data/species';
import type { World } from '../sim/World';
import type { Dino } from '../sim/types';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;
let activeDinoId: string | null = null;
let refreshTimer: number | null = null;

export function mountDinoPanel(getWorld: () => World): void {
  on<{ dinoId: string }>(Events.DinoClicked, ({ dinoId }) => {
    activeDinoId = dinoId;
    render(getWorld());
  });
}

function render(world: World): void {
  if (panel && document.body.contains(panel)) {
    closePanel();
    panel = null;
    stopRefresh();
  }
  const dino = activeDinoId ? world.dinos.get(activeDinoId) : null;
  if (!dino) return;

  panel = makePanel(dino.name);
  populate(panel, world, dino);
  openPanel(panel);

  // Live-refresh age and satiation while open.
  refreshTimer = window.setInterval(() => {
    if (!panel || !document.body.contains(panel)) {
      stopRefresh();
      return;
    }
    const d = activeDinoId ? world.dinos.get(activeDinoId) : null;
    if (!d) {
      closePanel();
      panel = null;
      stopRefresh();
      return;
    }
    populate(panel, world, d);
  }, 500);
}

function stopRefresh(): void {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function populate(panel: HTMLElement, world: World, dino: Dino): void {
  const body = panel.querySelector('[data-body]') as HTMLElement;
  body.innerHTML = '';
  const species = getSpecies(dino.speciesId);

  // Portrait — falls back to a colored circle if image is missing.
  const portraitWrap = document.createElement('div');
  portraitWrap.style.cssText = 'display:flex;justify-content:center;margin-bottom:10px;';
  const img = document.createElement('img');
  img.src = species.portraitPath;
  img.alt = species.displayName;
  img.style.cssText = `width:120px;height:120px;border-radius:8px;object-fit:cover;background:${species.color};`;
  img.addEventListener('error', () => {
    img.style.display = 'none';
    fallback.style.display = 'block';
  });
  const fallback = document.createElement('div');
  fallback.style.cssText = `width:120px;height:120px;border-radius:60px;background:${species.color};display:none;`;
  portraitWrap.appendChild(img);
  portraitWrap.appendChild(fallback);
  body.appendChild(portraitWrap);

  // Stats rows.
  addRow(body, 'Species', species.displayName);
  addRow(body, 'Age', formatAge(world.tick - dino.birthTick));
  addRow(body, 'Satiation', `${Math.round(dino.satiation)}%`);
}

function addRow(body: HTMLElement, label: string, value: string): void {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<div>${label}</div><div style="color:#cfcf">${value}</div>`;
  body.appendChild(row);
}

function formatAge(ticks: number): string {
  if (ticks < 0) ticks = 0;
  const dayTicks = config.time.dayTicks;
  const totalDays = Math.floor(ticks / dayTicks);
  const totalMonths = Math.floor(totalDays / 30);
  const years = Math.floor(totalMonths / 360);
  const months = totalMonths % 360;
  const days = totalDays % 30;
  return `${years}y ${months}m ${days}d`;
}
