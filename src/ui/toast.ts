import { on, Events } from '../EventBus';

const root = () => document.getElementById('ui-root')!;

export function initToasts(): void {
  on<{ msg: string }>(Events.ToastError, ({ msg }) => {
    showToast(msg);
  });
}

export function showToast(msg: string): void {
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  root().appendChild(div);
  setTimeout(() => div.remove(), 2500);
}
