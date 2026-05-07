import { on, Events } from '../EventBus';
import { getSpecies } from '../data/species';
import type { World } from '../sim/World';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;
let activeEnclosureId: string | null = null;

export function mountExhibitPanel(getWorld: () => World): void {
  on<{ enclosureId: string }>(Events.EnclosureClicked, ({ enclosureId }) => {
    activeEnclosureId = enclosureId;
    render(getWorld());
  });
  on(Events.TickAdvanced, () => maybeRerender(getWorld()));
}

function maybeRerender(world: World): void {
  if (!panel || !document.body.contains(panel)) {
    panel = null;
    return;
  }
  if (!activeEnclosureId || !world.enclosures.has(activeEnclosureId)) {
    closePanel();
    panel = null;
    return;
  }
  populate(panel, world);
}

function render(world: World): void {
  if (!activeEnclosureId) return;
  const enc = world.enclosures.get(activeEnclosureId);
  if (!enc) return;
  if (panel && document.body.contains(panel)) {
    closePanel();
    panel = null;
    return;
  }
  const title = enc.speciesId ? `${getSpecies(enc.speciesId).displayName} Exhibit` : 'Exhibit';
  panel = makePanel(title);
  populate(panel, world);
  openPanel(panel);
}

function populate(panel: HTMLElement, world: World): void {
  if (!activeEnclosureId) return;
  const enc = world.enclosures.get(activeEnclosureId);
  if (!enc) return;
  const body = panel.querySelector('[data-body]') as HTMLElement;
  body.innerHTML = '';

  const dinos = Array.from(world.dinos.values()).filter((d) => d.enclosureId === enc.id);
  let poopCount = 0;
  for (const p of world.poops.values()) {
    if (p.enclosureId === enc.id) poopCount++;
  }

  const stats = document.createElement('div');
  stats.className = 'row';
  stats.style.color = '#aaa';
  stats.style.fontSize = '11px';
  stats.textContent = `Poop: ${poopCount}`;
  body.appendChild(stats);

  if (dinos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'row';
    empty.style.color = '#aaa';
    empty.textContent = enc.speciesId ? 'No dinosaurs here.' : 'Empty exhibit.';
    body.appendChild(empty);
    return;
  }

  for (const d of dinos) {
    const sp = getSpecies(d.speciesId);
    const row = document.createElement('div');
    row.className = 'row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const name = document.createElement('div');
    name.textContent = d.name || sp.displayName;
    name.style.flex = '1';

    const meta = document.createElement('div');
    meta.style.color = '#aaa';
    meta.style.fontSize = '11px';
    meta.textContent = `HP ${Math.round(d.health)} · Sat ${Math.round(d.satiation)}`;

    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'Sell ($0)';
    sellBtn.title = 'Sell this dinosaur';
    sellBtn.addEventListener('click', () => {
      world.dinos.delete(d.id);
      world.log(`Sold ${d.name || sp.displayName} for $0.`);
      populate(panel, world);
    });

    row.appendChild(name);
    row.appendChild(meta);
    row.appendChild(sellBtn);
    body.appendChild(row);
  }
}
