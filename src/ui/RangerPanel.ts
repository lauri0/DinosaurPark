import { on, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from '../sim/World';
import { hireRanger } from '../sim/Rangers';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;
let activeStationId: string | null = null;

export function mountRangerPanel(getWorld: () => World): void {
  on<{ buildingId: string }>(Events.RangerStationClicked, ({ buildingId }) => {
    activeStationId = buildingId;
    render(getWorld());
  });
  on(Events.RangerHired, () => maybeRerender(getWorld()));
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
  panel = makePanel('Ranger Station');
  populate(panel, world);
  openPanel(panel);
}

function populate(panel: HTMLElement, world: World): void {
  const body = panel.querySelector('[data-body]') as HTMLElement;
  body.innerHTML = '';
  if (!activeStationId) return;
  const rangers = Array.from(world.rangers.values()).filter((r) => r.stationId === activeStationId);
  for (const r of rangers) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div>${r.name}</div><div style="color:#aaa">${r.state}</div>`;
    body.appendChild(row);
  }
  const remaining = config.ranger.maxPerStation - rangers.length;
  const hireBtn = document.createElement('button');
  hireBtn.textContent = `Hire Ranger ($${config.economy.rangerWagePerDay}/day)`;
  hireBtn.disabled = remaining <= 0;
  hireBtn.style.marginTop = '8px';
  hireBtn.addEventListener('click', () => {
    hireRanger(world, activeStationId!);
    populate(panel, world);
  });
  body.appendChild(hireBtn);
}
