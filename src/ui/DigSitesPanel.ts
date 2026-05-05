import { on, Events } from '../EventBus';
import { DIG_SITES } from '../data/digSites';
import { config } from '../data/config';
import type { World } from '../sim/World';
import { dispatchExpedition, unlockDigSite } from '../sim/DigSites';
import { makePanel, openPanel, closePanel } from './panel';

export function mountDigSitesPanel(getWorld: () => World): void {
  on(Events.DigSiteUnlockRequested, () => render(getWorld()));
  on(Events.ExpeditionDispatched, () => maybeRerender(getWorld()));
  on(Events.ExpeditionReturned, () => maybeRerender(getWorld()));
  on(Events.CashChanged, () => maybeRerender(getWorld()));
  on(Events.TickAdvanced, () => maybeRerender(getWorld()));
}

let panel: HTMLElement | null = null;

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
  panel = makePanel('Dig Sites');
  populate(panel, world);
  openPanel(panel);
}

function populate(panel: HTMLElement, world: World): void {
  const body = panel.querySelector('[data-body]') as HTMLElement;
  body.innerHTML = '';

  // Active expedition banner.
  if (world.activeExpedition) {
    const def = DIG_SITES.find((s) => s.id === world.activeExpedition!.siteId)!;
    const remaining = world.activeExpedition.finishesAtTick - world.tick;
    const banner = document.createElement('div');
    banner.style.padding = '6px';
    banner.style.background = '#1f2a1f';
    banner.style.border = '1px solid #4a8a4a';
    banner.style.borderRadius = '4px';
    banner.style.marginBottom = '8px';
    banner.textContent = `Active: ${def.name} — ${remaining} ticks remaining`;
    body.appendChild(banner);
  }

  const unlockedCount = Array.from(world.digSites.values()).filter((s) => s.unlocked).length;
  const nextUnlockCost = config.economy.digSiteUnlockCosts[unlockedCount - 1] ?? null;

  for (const def of DIG_SITES) {
    const state = world.digSites.get(def.id)!;
    const row = document.createElement('div');
    row.className = 'row';
    row.style.flexWrap = 'wrap';
    const left = document.createElement('div');
    left.style.flex = '1';
    left.innerHTML = `<strong>${def.name}</strong> <span style="color:#999">(${def.region})</span><br>
      <small>Quality: ${state.quality} · Species: ${def.species.join(', ')} · Cost: $${def.teamCost} · ${def.expeditionDurationTicks}t</small>`;
    row.appendChild(left);

    const right = document.createElement('div');
    if (!state.unlocked) {
      const btn = document.createElement('button');
      const cost = nextUnlockCost ?? Infinity;
      btn.textContent = `Unlock $${cost}`;
      btn.disabled = world.cash < cost || nextUnlockCost === null;
      btn.addEventListener('click', () => {
        unlockDigSite(world, def.id);
        populate(panel, world);
      });
      right.appendChild(btn);
    } else if (state.quality === 'Exhausted') {
      right.textContent = 'Exhausted';
    } else {
      const btn = document.createElement('button');
      btn.textContent = 'Dispatch';
      btn.disabled =
        !!world.activeExpedition || !!world.pendingHaul || world.cash < def.teamCost;
      btn.addEventListener('click', () => {
        dispatchExpedition(world, def.id);
        populate(panel, world);
      });
      right.appendChild(btn);
    }
    row.appendChild(right);
    body.appendChild(row);
  }
}
