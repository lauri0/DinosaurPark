import { emit, on, Events } from '../EventBus';
import { SPECIES, getSpecies } from '../data/species';
import { config } from '../data/config';
import type { World } from '../sim/World';
import { startHatch, pickUpHatchling } from '../sim/Hatchery';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;
let activeHatcheryId: string | null = null;

export function mountHatcheryPanel(getWorld: () => World): void {
  on<{ buildingId: string | null }>(Events.HatcheryClicked, ({ buildingId }) => {
    activeHatcheryId = buildingId;
    if (!buildingId) {
      // Pick first hatchery if any.
      for (const b of getWorld().buildings.values()) {
        if (b.type === 'Hatchery') { activeHatcheryId = b.id; break; }
      }
    }
    render(getWorld());
  });
  on(Events.HatchStarted, () => maybeRerender(getWorld()));
  on(Events.HatchReady, () => maybeRerender(getWorld()));
  on(Events.HatchPlaced, () => maybeRerender(getWorld()));
  on(Events.TickAdvanced, () => maybeRerender(getWorld()));
  on(Events.FossilExtracted, () => maybeRerender(getWorld()));
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
  panel = makePanel('Hatchery');
  populate(panel, world);
  openPanel(panel);
}

function populate(p: HTMLElement | null, world: World): void {
  if (!p) return;
  const body = p.querySelector('[data-body]') as HTMLElement;
  body.innerHTML = '';

  const hatcheries = Array.from(world.buildings.values()).filter((b) => b.type === 'Hatchery');
  if (hatcheries.length === 0) {
    body.innerHTML = '<p style="color:#aaa">No Hatchery built yet.</p>';
    return;
  }
  if (!activeHatcheryId || !world.buildings.has(activeHatcheryId)) {
    activeHatcheryId = hatcheries[0]!.id;
  }
  if (hatcheries.length > 1) {
    const sel = document.createElement('select');
    for (const h of hatcheries) {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = `Hatchery @ (${h.x},${h.y})`;
      if (h.id === activeHatcheryId) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      activeHatcheryId = sel.value;
      populate(panel, world);
    });
    body.appendChild(sel);
  }

  const inProgress = world.hatchInProgress.find((h) => h.hatcheryId === activeHatcheryId);
  if (inProgress) {
    const remaining = inProgress.finishesAtTick - world.tick;
    const sp = getSpecies(inProgress.speciesId);
    const symbol = inProgress.sex === 'male' ? '♂' : '♀';
    const div = document.createElement('div');
    div.style.padding = '6px';
    div.style.marginTop = '6px';
    div.style.background = '#1f2a1f';
    div.textContent = `Hatching ${symbol} ${sp.displayName} — ${Math.max(0, remaining)} ticks`;
    body.appendChild(div);
  } else {
    const h2 = document.createElement('h3');
    h2.textContent = 'Hatch';
    h2.style.fontSize = '13px';
    h2.style.margin = '6px 0';
    body.appendChild(h2);
    let any = false;
    for (const sp of SPECIES) {
      const dna = world.dna[sp.id] ?? 0;
      if (dna < config.expedition.hatchThreshold) continue;
      any = true;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div><strong style="color:${sp.color}">${sp.displayName}</strong> ${Math.round(dna)}%</div>`;
      const btnGroup = document.createElement('div');
      btnGroup.style.display = 'flex';
      btnGroup.style.gap = '4px';
      const maleBtn = document.createElement('button');
      maleBtn.textContent = `♂ (${config.expedition.hatchTicks}t)`;
      maleBtn.addEventListener('click', () => {
        startHatch(world, activeHatcheryId!, sp.id, 'male');
        populate(panel, world);
      });
      const femaleBtn = document.createElement('button');
      femaleBtn.textContent = `♀ (${config.expedition.hatchTicks}t)`;
      femaleBtn.addEventListener('click', () => {
        startHatch(world, activeHatcheryId!, sp.id, 'female');
        populate(panel, world);
      });
      btnGroup.appendChild(maleBtn);
      btnGroup.appendChild(femaleBtn);
      row.appendChild(btnGroup);
      body.appendChild(row);
    }
    if (!any) {
      const p = document.createElement('p');
      p.style.color = '#aaa';
      p.textContent = `Need ≥${config.expedition.hatchThreshold}% DNA to hatch a species.`;
      body.appendChild(p);
    }
  }

  // Pending hatchlings.
  if (world.pendingHatchlings.length > 0) {
    const h2 = document.createElement('h3');
    h2.textContent = 'Ready to place';
    h2.style.fontSize = '13px';
    h2.style.margin = '10px 0 6px';
    body.appendChild(h2);
    for (const h of world.pendingHatchlings) {
      const sp = getSpecies(h.speciesId);
      const symbol = h.sex === 'male' ? '♂' : '♀';
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div><strong style="color:${sp.color}">${symbol} ${sp.displayName}</strong> hatchling</div>`;
      const btn = document.createElement('button');
      btn.textContent = world.carryHatchlingId === h.id ? 'Carrying…' : 'Pick Up';
      btn.disabled = !!world.carryHatchlingId && world.carryHatchlingId !== h.id;
      btn.addEventListener('click', () => {
        pickUpHatchling(world, h.id);
        emit(Events.BuildModeChanged, { mode: 'carry' });
        closePanel();
        panel = null;
      });
      row.appendChild(btn);
      body.appendChild(row);
    }
  }
}
