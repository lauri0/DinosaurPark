import { on, Events } from '../EventBus';
import { decideFossil, dismissHaulIfEmpty } from '../sim/DigSites';
import { getSpecies } from '../data/species';
import type { World } from '../sim/World';

let backdrop: HTMLDivElement | null = null;

export function mountHaulModal(getWorld: () => World): void {
  on(Events.ExpeditionReturned, () => render(getWorld()));
  // Re-render after each fossil decision.
  on(Events.FossilExtracted, () => render(getWorld()));
  on(Events.FossilSold, () => render(getWorld()));
}

function render(world: World): void {
  const haul = world.pendingHaul;
  if (!haul) {
    if (backdrop) {
      backdrop.remove();
      backdrop = null;
    }
    return;
  }
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.getElementById('ui-root')!.appendChild(backdrop);
  }
  backdrop.innerHTML = '';
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<h2>Haul Returned</h2>`;
  backdrop.appendChild(m);

  if (haul.valuables > 0) {
    const v = document.createElement('div');
    v.style.marginBottom = '8px';
    v.style.color = '#9bd09b';
    v.textContent = `Bonus valuable auto-sold: +$${haul.valuables}`;
    m.appendChild(v);
  }

  for (const f of haul.fossils) {
    const decision = haul.decided[f.id];
    const row = document.createElement('div');
    row.className = 'row';
    const sp = getSpecies(f.speciesId);
    const left = document.createElement('div');
    left.innerHTML = `<strong>${sp.displayName}</strong> — ${f.dnaPercent}% DNA`;
    row.appendChild(left);
    const right = document.createElement('div');
    if (decision) {
      right.textContent = decision === 'extract' ? 'Extracted' : `Sold $${f.dnaPercent * 5}`;
      right.style.color = '#9bd09b';
    } else {
      const ext = document.createElement('button');
      ext.textContent = 'Extract';
      ext.addEventListener('click', () => decideFossil(world, f.id, 'extract'));
      const sell = document.createElement('button');
      sell.textContent = `Sell $${f.dnaPercent * 5}`;
      sell.addEventListener('click', () => decideFossil(world, f.id, 'sell'));
      right.appendChild(ext);
      right.appendChild(sell);
    }
    row.appendChild(right);
    m.appendChild(row);
  }

  // Always show a close button; undecided fossils are discarded on close.
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '12px';
  closeBtn.addEventListener('click', () => {
    world.pendingHaul = null;
    render(world);
  });
  m.appendChild(closeBtn);
}
