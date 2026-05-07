import { emit, on, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from '../sim/World';
import { hireRanger, fireRanger, reassignRanger } from '../sim/Rangers';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;
let activeStationId: string | null = null;
let pendingReassignRangerId: string | null = null;

export function mountRangerPanel(getWorld: () => World): void {
  on<{ buildingId: string }>(Events.RangerStationClicked, ({ buildingId }) => {
    const world = getWorld();
    if (pendingReassignRangerId) {
      const rangerId = pendingReassignRangerId;
      pendingReassignRangerId = null;
      const result = reassignRanger(world, rangerId, buildingId);
      if (!result.ok) {
        emit(Events.ToastError, { msg: result.reason });
      } else {
        activeStationId = buildingId;
      }
      if (!panel || !document.body.contains(panel)) {
        panel = makePanel('Ranger Station');
        openPanel(panel);
      }
      populate(panel, world);
      return;
    }
    activeStationId = buildingId;
    render(world);
  });
  on(Events.RangerHired, () => maybeRerender(getWorld()));
  on(Events.RangerFired, () => maybeRerender(getWorld()));
  on(Events.RangerReassigned, () => maybeRerender(getWorld()));
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
    pendingReassignRangerId = null;
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

  // If the station we're showing was removed, bail gracefully.
  if (!world.buildings.has(activeStationId)) {
    pendingReassignRangerId = null;
    const msg = document.createElement('div');
    msg.textContent = 'Ranger station no longer exists.';
    msg.style.color = '#aaa';
    body.appendChild(msg);
    return;
  }

  // Drop a stale pending-reassign if its ranger is gone.
  if (pendingReassignRangerId && !world.rangers.get(pendingReassignRangerId)) {
    pendingReassignRangerId = null;
  }

  const rangers = Array.from(world.rangers.values()).filter((r) => r.stationId === activeStationId);
  for (const r of rangers) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    const name = document.createElement('div');
    name.textContent = r.name;
    name.style.flex = '1';
    const state = document.createElement('div');
    state.textContent = r.state;
    state.style.color = '#aaa';

    const moveBtn = document.createElement('button');
    const isPending = pendingReassignRangerId === r.id;
    moveBtn.textContent = isPending ? 'Cancel' : 'Move';
    moveBtn.addEventListener('click', () => {
      pendingReassignRangerId = isPending ? null : r.id;
      populate(panel, world);
    });

    const fireBtn = document.createElement('button');
    fireBtn.textContent = 'Fire';
    fireBtn.addEventListener('click', () => {
      if (pendingReassignRangerId === r.id) pendingReassignRangerId = null;
      fireRanger(world, r.id);
      populate(panel, world);
    });
    row.appendChild(name);
    row.appendChild(state);
    row.appendChild(moveBtn);
    row.appendChild(fireBtn);
    body.appendChild(row);
  }

  if (pendingReassignRangerId) {
    const prompt = document.createElement('div');
    prompt.textContent = 'Click a ranger station to reassign…';
    prompt.style.marginTop = '8px';
    prompt.style.color = '#ffcb6b';
    body.appendChild(prompt);
  }

  const remaining = config.ranger.maxPerStation - rangers.length;
  const hireBtn = document.createElement('button');
  hireBtn.textContent = `Hire Ranger ($${config.economy.rangerWagePerMonth}/month)`;
  hireBtn.disabled = remaining <= 0;
  hireBtn.style.marginTop = '8px';
  hireBtn.addEventListener('click', () => {
    hireRanger(world, activeStationId!);
    populate(panel, world);
  });
  body.appendChild(hireBtn);
}
