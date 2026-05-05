// Helper: at most one side panel open at a time.
let currentPanel: HTMLElement | null = null;

export function openPanel(node: HTMLElement): void {
  closePanel();
  document.getElementById('ui-root')!.appendChild(node);
  currentPanel = node;
}

export function closePanel(): void {
  if (currentPanel) {
    currentPanel.remove();
    currentPanel = null;
  }
}

export function isPanelOpen(): boolean {
  return currentPanel !== null;
}

export function makePanel(title: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'panel';
  div.innerHTML = `<h2>${title} <button data-close style="float:right">×</button></h2><div data-body></div>`;
  div.querySelector('[data-close]')?.addEventListener('click', () => closePanel());
  return div;
}
