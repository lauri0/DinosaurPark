import { on, Events } from '../EventBus';
import { config } from '../data/config';
import {
  getFacilityDef,
  PRICE_TIERS,
  PRICE_TIER_LABEL,
  type FacilityDef,
  type PriceTier,
} from '../data/facilities';
import type { World } from '../sim/World';
import type { Building } from '../sim/types';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;
let activeBuildingId: string | null = null;

export function mountFacilityPanel(getWorld: () => World): void {
  on<{ buildingId: string }>(Events.FacilityClicked, ({ buildingId }) => {
    activeBuildingId = buildingId;
    render(getWorld());
  });
  on(Events.TickAdvanced, () => maybeRerender(getWorld()));
}

function maybeRerender(world: World): void {
  if (!panel || !document.body.contains(panel)) {
    panel = null;
    return;
  }
  const b = activeBuildingId ? world.buildings.get(activeBuildingId) : null;
  if (!b || !b.facility) {
    closePanel();
    panel = null;
    return;
  }
  const def = getFacilityDef(b.type);
  if (!def) return;
  populate(panel, world, b, def);
}

function render(world: World): void {
  const b = activeBuildingId ? world.buildings.get(activeBuildingId) : null;
  if (!b || !b.facility) return;
  const def = getFacilityDef(b.type);
  if (!def) return;
  if (panel && document.body.contains(panel)) {
    closePanel();
    panel = null;
    return;
  }
  panel = makePanel(`${def.facilityName} ${b.facility.number}`);
  populate(panel, world, b, def);
  openPanel(panel);
}

function populate(panel: HTMLElement, world: World, b: Building, def: FacilityDef): void {
  if (!b.facility) return;
  const body = panel.querySelector('[data-body]') as HTMLElement;
  body.innerHTML = '';

  const profit = b.facility.revenueTotal - b.facility.upkeepPaidTotal;
  const profitLast = b.facility.revenueLastMonth - b.facility.upkeepLastMonth;
  addRow(body, 'Revenue', formatMoney(b.facility.revenueTotal));
  addRow(body, 'Profit', formatMoney(profit));
  addRow(body, 'Profit last month', formatMoney(profitLast));
  addRow(body, 'In operation', formatDuration(world.tick - b.facility.builtAtTick));
  addRow(body, 'Upkeep', `$${def.upkeepPerMonth} / month`);
  addRow(
    body,
    'Price',
    `${PRICE_TIER_LABEL[b.facility.priceTier]} ($${def.prices[b.facility.priceTier]})`,
  );

  const priceLabel = document.createElement('div');
  priceLabel.textContent = 'Set price';
  priceLabel.style.marginTop = '8px';
  priceLabel.style.color = '#cfcf';
  body.appendChild(priceLabel);

  const group = document.createElement('div');
  group.style.display = 'flex';
  group.style.gap = '4px';
  group.style.marginTop = '4px';
  for (const tier of PRICE_TIERS) {
    const btn = document.createElement('button');
    btn.textContent = `${PRICE_TIER_LABEL[tier]} ($${def.prices[tier]})`;
    btn.style.flex = '1';
    const selected = b.facility.priceTier === tier;
    if (selected) {
      btn.style.background = '#3b6e3b';
      btn.style.borderColor = '#6cba6c';
      btn.style.color = '#fff';
      btn.style.fontWeight = 'bold';
      btn.disabled = true;
      btn.title = 'Currently selected';
    }
    btn.addEventListener('click', () => {
      if (!b.facility) return;
      b.facility.priceTier = tier;
      populate(panel, world, b, def);
    });
    group.appendChild(btn);
  }
  body.appendChild(group);
}

function addRow(body: HTMLElement, label: string, value: string): void {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<div>${label}</div><div style="color:#cfcf">${value}</div>`;
  body.appendChild(row);
}

function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString()}`;
}

function formatDuration(ticks: number): string {
  if (ticks < 0) ticks = 0;
  const dayTicks = config.time.dayTicks;
  const monthDays = config.time.monthDays;
  const totalDays = Math.floor(ticks / dayTicks);
  const months = Math.floor(totalDays / monthDays);
  const days = totalDays % monthDays;
  const remTicks = ticks % dayTicks;
  if (months > 0) return `${months}mo ${days}d`;
  if (totalDays > 0) return `${totalDays}d ${remTicks}t`;
  return `${ticks}t`;
}

// Re-export for convenience.
export type { PriceTier };
