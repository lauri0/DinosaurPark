import { on, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from '../sim/World';
import type { Visitor } from '../sim/types';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;
let activeVisitorId: string | null = null;
let refreshTimer: number | null = null;

export function mountVisitorPanel(getWorld: () => World): void {
  on<{ visitorId: string }>(Events.VisitorClicked, ({ visitorId }) => {
    activeVisitorId = visitorId;
    render(getWorld());
  });
}

function render(world: World): void {
  if (panel && document.body.contains(panel)) {
    closePanel();
    panel = null;
    stopRefresh();
  }
  const visitor = activeVisitorId ? world.visitors.get(activeVisitorId) : null;
  if (!visitor) return;

  panel = makePanel(visitor.name);
  populate(panel, world, visitor);
  openPanel(panel);

  refreshTimer = window.setInterval(() => {
    if (!panel || !document.body.contains(panel)) {
      stopRefresh();
      return;
    }
    const v = activeVisitorId ? world.visitors.get(activeVisitorId) : null;
    if (!v) {
      closePanel();
      panel = null;
      stopRefresh();
      return;
    }
    populate(panel, world, v);
  }, 500);
}

function stopRefresh(): void {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function populate(panel: HTMLElement, world: World, visitor: Visitor): void {
  const body = panel.querySelector('[data-body]') as HTMLElement;
  let stats = body.querySelector('[data-stats]') as HTMLElement | null;
  if (!stats) {
    body.innerHTML = '';
    stats = document.createElement('div');
    stats.setAttribute('data-stats', '');
    body.appendChild(stats);
  }

  stats.innerHTML = '';
  addRow(stats, 'Time in park', formatDuration(world.tick - visitor.arrivedAtTick));
  addBarRow(stats, 'Drink', visitor.drink, config.visitors.drinkMax);
}

function addBarRow(body: HTMLElement, label: string, value: number, max: number): void {
  const pct = Math.max(0, Math.min(1, value / max));
  const color = pct >= 0.5 ? '#4cd964' : pct >= 0.3 ? '#f2a93a' : '#e74c3c';
  const row = document.createElement('div');
  row.className = 'row';
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  const lbl = document.createElement('div');
  lbl.textContent = label;
  lbl.style.flex = '0 0 90px';
  const bar = document.createElement('div');
  bar.style.flex = '1';
  bar.style.height = '8px';
  bar.style.background = 'rgba(255,255,255,0.1)';
  bar.style.borderRadius = '4px';
  bar.style.overflow = 'hidden';
  const fill = document.createElement('div');
  fill.style.width = `${pct * 100}%`;
  fill.style.height = '100%';
  fill.style.background = color;
  bar.appendChild(fill);
  const num = document.createElement('div');
  num.textContent = `${Math.round(value)}/${max}`;
  num.style.color = '#cfcf';
  num.style.flex = '0 0 56px';
  num.style.textAlign = 'right';
  row.appendChild(lbl);
  row.appendChild(bar);
  row.appendChild(num);
  body.appendChild(row);
}

function addRow(body: HTMLElement, label: string, value: string): void {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<div>${label}</div><div style="color:#cfcf">${value}</div>`;
  body.appendChild(row);
}

function formatDuration(ticks: number): string {
  if (ticks < 0) ticks = 0;
  const dayTicks = config.time.dayTicks;
  const days = Math.floor(ticks / dayTicks);
  const remTicks = ticks % dayTicks;
  if (days > 0) return `${days}d ${remTicks}t`;
  return `${ticks}t`;
}
