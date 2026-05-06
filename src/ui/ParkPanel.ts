import { emit, on, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from '../sim/World';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;

export function mountParkPanel(getWorld: () => World): void {
  const open = () => render(getWorld());
  on('open-park', open);
  on<{ buildingId: string | null }>(Events.EntranceGateClicked, open);
  on(Events.TickAdvanced, () => {
    if (panel && document.body.contains(panel)) populate(panel, getWorld());
  });
}

function render(world: World): void {
  if (panel && document.body.contains(panel)) {
    closePanel();
    panel = null;
    return;
  }
  panel = makePanel('Park');
  populate(panel, world);
  openPanel(panel);
}

function populate(panel: HTMLElement, world: World): void {
  const body = panel.querySelector('[data-body]') as HTMLElement;
  body.innerHTML = '';

  const slider = document.createElement('div');
  slider.className = 'slider-row';
  slider.innerHTML = `
    <label>Admission $<span data-val>${world.admissionPrice}</span></label>
    <input type="range" min="${config.economy.admissionMin}" max="${config.economy.admissionMax}" value="${world.admissionPrice}" step="1" />
  `;
  const input = slider.querySelector('input')!;
  const valSpan = slider.querySelector('[data-val]') as HTMLElement;
  input.addEventListener('input', () => {
    world.admissionPrice = Number(input.value);
    valSpan.textContent = String(world.admissionPrice);
    emit(Events.AdmissionPriceChanged, { price: world.admissionPrice });
  });
  body.appendChild(slider);

  addRow(body, 'Admission revenue (total)', formatMoney(world.admissionRevenueTotal));
  addRow(body, 'Admission revenue (last month)', formatMoney(world.admissionRevenueLastMonth));
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
