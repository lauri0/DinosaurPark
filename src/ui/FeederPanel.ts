import { on, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from '../sim/World';
import { changeCash } from '../sim/Economy';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;
let activeFeederId: string | null = null;

export function mountFeederPanel(getWorld: () => World): void {
  on<{ buildingId: string }>(Events.FeederClicked, ({ buildingId }) => {
    activeFeederId = buildingId;
    render(getWorld());
  });
  on(Events.TickAdvanced, () => maybeRerender(getWorld()));
}

function maybeRerender(world: World): void {
  if (!panel || !document.body.contains(panel)) {
    panel = null;
    return;
  }
  populate(panel, world);
}

function render(world: World): void {
  if (panel && document.body.contains(panel)) {
    closePanel();
    panel = null;
    return;
  }
  panel = makePanel('Feeder');
  populate(panel, world);
  openPanel(panel);
}

function populate(panel: HTMLElement, world: World): void {
  const body = panel.querySelector('[data-body]') as HTMLElement;
  body.innerHTML = '';
  if (!activeFeederId) return;
  const feeder = world.buildings.get(activeFeederId);
  if (!feeder) return;
  const food = feeder.food ?? 0;
  body.innerHTML = `<div class="row"><div>Food</div><div>${Math.round(food)} / ${config.feeder.capacity}</div></div>`;
  const refillCost = (config.feeder.capacity - food) * config.economy.foodCostPerUnit;
  const btn = document.createElement('button');
  btn.textContent = `Refill ($${Math.round(refillCost)})`;
  btn.disabled = food >= config.feeder.capacity || world.cash < refillCost;
  btn.addEventListener('click', () => {
    feeder.food = config.feeder.capacity;
    changeCash(world, -refillCost, 'manual feeder refill');
    populate(panel, world);
  });
  body.appendChild(btn);
}
