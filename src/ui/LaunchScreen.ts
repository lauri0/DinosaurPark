import { hasSave } from '../sim/Save';

export interface LaunchChoice {
  kind: 'new' | 'load';
}

export function showLaunchScreen(): Promise<LaunchChoice> {
  return new Promise((resolve) => {
    const root = document.getElementById('ui-root')!;
    const screen = document.createElement('div');
    screen.className = 'launch-screen';
    screen.innerHTML = `
      <h1>Dinosaur Park</h1>
      <div class="sub">A vector-styled park-builder</div>
      <button data-action="new">New Game</button>
      <button data-action="load" ${hasSave() ? '' : 'disabled'}>Load Game</button>
      <button data-action="continue" ${hasSave() ? '' : 'disabled'}>Continue</button>
    `;
    root.appendChild(screen);

    const close = (choice: LaunchChoice) => {
      screen.remove();
      resolve(choice);
    };
    screen.querySelector('[data-action="new"]')?.addEventListener('click', () => close({ kind: 'new' }));
    screen.querySelector('[data-action="load"]')?.addEventListener('click', () => close({ kind: 'load' }));
    screen.querySelector('[data-action="continue"]')?.addEventListener('click', () => close({ kind: 'load' }));
  });
}
