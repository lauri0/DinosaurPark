import { on, Events } from '../EventBus';
import type { World } from '../sim/World';

export function mountNotificationLog(getWorld: () => World): void {
  const root = document.getElementById('ui-root')!;
  const div = document.createElement('div');
  div.className = 'notif-log';
  root.appendChild(div);

  let lastSeen = 0;
  const refresh = () => {
    const w = getWorld();
    const all = w.notifications;
    if (all.length === lastSeen) return;
    // Append new ones.
    for (let i = lastSeen; i < all.length; i++) {
      const e = all[i]!;
      const item = document.createElement('div');
      item.className = 'entry';
      item.innerHTML = `<span class="tick">[t${e.tick}]</span>${escape(e.msg)}`;
      div.appendChild(item);
    }
    lastSeen = all.length;
    // Cap DOM children to avoid runaway.
    while (div.childElementCount > 200) div.firstElementChild?.remove();
    div.scrollTop = div.scrollHeight;
  };
  on(Events.TickAdvanced, refresh);
  on(Events.Notification, refresh);
  on(Events.StateReset, () => {
    div.innerHTML = '';
    lastSeen = 0;
    refresh();
  });
  refresh();
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
