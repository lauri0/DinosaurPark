import { on, Events } from '../EventBus';
import { SPECIES } from '../data/species';
import type { World } from '../sim/World';
import { makePanel, openPanel, closePanel } from './panel';

let panel: HTMLElement | null = null;

export function mountDNAPanel(getWorld: () => World): void {
  on(Events.FossilCentreClicked, () => render(getWorld()));
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
  panel = makePanel('DNA Manager');
  populate(panel, world);
  openPanel(panel);
}

function populate(panel: HTMLElement, world: World): void {
  const body = panel.querySelector('[data-body]') as HTMLElement;
  body.innerHTML = '';
  for (const sp of SPECIES) {
    const dna = world.dna[sp.id] ?? 0;
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div style="flex:1">
        <strong style="color:${sp.color}">${sp.displayName}</strong>
        <div style="background:#222; height:8px; border-radius:3px; margin-top:4px; overflow:hidden">
          <div style="background:${sp.color}; height:100%; width:${dna}%"></div>
        </div>
      </div>
      <div style="margin-left:8px; min-width:50px; text-align:right">${Math.round(dna)}%</div>
    `;
    body.appendChild(row);
  }
}
