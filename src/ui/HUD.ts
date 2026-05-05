import { emit, on, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from '../sim/World';

export function mountHUD(getWorld: () => World): void {
  const root = document.getElementById('ui-root')!;
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = `
    <div class="cash">$<span data-cash>0</span></div>
    <div>Day <span data-day>1</span></div>
    <div>Tick <span data-tick>0</span></div>
    <div class="speeds">
      <button data-speed="0">⏸</button>
      <button data-speed="1">1×</button>
      <button data-speed="2">2×</button>
      <button data-speed="3">3×</button>
    </div>
    <button data-open-digsites>Dig Sites</button>
    <button data-open-dna>DNA</button>
    <button data-open-hatchery>Hatchery</button>
    <button data-open-park>Park</button>
    <button data-open-settings>⚙</button>
  `;
  root.appendChild(hud);

  const cashSpan = hud.querySelector('[data-cash]') as HTMLElement;
  const cashWrap = hud.querySelector('.cash') as HTMLElement;
  const daySpan = hud.querySelector('[data-day]') as HTMLElement;
  const tickSpan = hud.querySelector('[data-tick]') as HTMLElement;

  const updateCash = (cash: number) => {
    cashSpan.textContent = Math.round(cash).toLocaleString();
  };
  updateCash(getWorld().cash);

  on<{ cash: number; delta: number }>(Events.CashChanged, ({ cash, delta }) => {
    updateCash(cash);
    cashWrap.classList.remove('flash-up', 'flash-down');
    void cashWrap.offsetWidth;
    cashWrap.classList.add(delta >= 0 ? 'flash-up' : 'flash-down');
  });

  on<{ tick: number }>(Events.TickAdvanced, ({ tick }) => {
    tickSpan.textContent = String(tick);
    daySpan.textContent = String(Math.floor(tick / config.time.dayTicks) + 1);
  });

  for (const btn of hud.querySelectorAll('[data-speed]')) {
    btn.addEventListener('click', () => {
      const s = Number((btn as HTMLElement).dataset.speed) as 0 | 1 | 2 | 3;
      getWorld().timeSpeed = s;
      for (const b of hud.querySelectorAll('[data-speed]')) {
        b.classList.toggle('active', (b as HTMLElement).dataset.speed === String(s));
      }
      emit(Events.TimeSpeedChanged, { speed: s });
    });
  }
  // Initial speed highlight.
  const w = getWorld();
  hud.querySelector(`[data-speed="${w.timeSpeed}"]`)?.classList.add('active');

  hud.querySelector('[data-open-digsites]')?.addEventListener('click', () => {
    emit(Events.DigSiteUnlockRequested, { open: true });
  });
  hud.querySelector('[data-open-dna]')?.addEventListener('click', () => {
    emit(Events.FossilCentreClicked, { buildingId: null });
  });
  hud.querySelector('[data-open-hatchery]')?.addEventListener('click', () => {
    emit(Events.HatcheryClicked, { buildingId: null });
  });
  hud.querySelector('[data-open-park]')?.addEventListener('click', () => {
    emit('open-park', null);
  });
  hud.querySelector('[data-open-settings]')?.addEventListener('click', () => {
    emit('open-settings', null);
  });
}
