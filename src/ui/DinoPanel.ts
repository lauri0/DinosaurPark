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
  const species = getSpecies(dino.speciesId);

  let stats = body.querySelector('[data-stats]') as HTMLElement | null;
  if (!stats) {
    body.innerHTML = '';

    // Portrait — show a colored circle by default and only swap to the image
    // once it actually loads. This avoids flickering a colored square while
    // the <img> is loading or before the error event fires for a missing png.
    const portraitWrap = document.createElement('div');
    portraitWrap.style.cssText = 'display:flex;justify-content:center;margin-bottom:10px;position:relative;height:160px;margin-left:auto;margin-right:auto;';
    const fallback = document.createElement('div');
    fallback.style.cssText = `height:160px;background:${species.color};`;
    portraitWrap.appendChild(fallback);
    const img = document.createElement('img');
    img.alt = species.displayName;
    img.style.cssText = 'height:160px;width:auto;object-fit:contain;display:none;position:absolute;inset:0;margin:auto;';
    img.addEventListener('load', () => {
      if (img.naturalWidth > 0) {
        img.style.display = 'block';
        fallback.style.display = 'none';
      }
    });
    img.src = species.portraitPath;
    portraitWrap.appendChild(img);
    body.appendChild(portraitWrap);

    stats = document.createElement('div');
    stats.setAttribute('data-stats', '');
    body.appendChild(stats);
  }

  stats.innerHTML = '';
  addRow(stats, 'Species', species.displayName);
  addRow(stats, 'Age', formatAge(world.tick - dino.birthTick));
  addRow(stats, 'Satiation', `${Math.round(dino.satiation)}%`);
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
