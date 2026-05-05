import { emit, Events } from '../EventBus';
import { config } from '../data/config';
import type { World } from './World';

export function changeCash(world: World, delta: number, reason?: string): void {
  world.cash += delta;
  emit(Events.CashChanged, { cash: world.cash, delta, reason });
}

export function tickEconomy(world: World): void {
  // Ranger wages
  let wages = 0;
  for (const _r of world.rangers.values()) {
    wages += config.economy.rangerWagePerDay / config.time.dayTicks;
  }
  if (wages > 0) {
    changeCash(world, -wages, 'ranger wages');
  }
}
