import { emit, on, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from '../sim/World';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;

export function mountParkPanel(getWorld: () => World): void {
  const open = () => render(getWorld());
  on('open-park', open);
  on<{ buildingId: string | null }>(Events.EntranceGateClicked, open);
}

function render(world: World): void {
  if (panel && document.body.contains(panel)) {
    closePanel();
    panel = null;
    return;
  }
  panel = makePanel('Park');
  const body = panel.querySelector('[data-body]') as HTMLElement;

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

  openPanel(panel);
}
