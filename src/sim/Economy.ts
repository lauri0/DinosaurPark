import { emit, Events } from '../EventBus';
import { config } from '../data/config';
import { getFacilityDef } from '../data/facilities';
import type { World } from './World';

export function changeCash(world: World, delta: number, reason?: string): void {
  world.cash += delta;
  emit(Events.CashChanged, { cash: world.cash, delta, reason });
}

export function monthTicks(): number {
  return config.time.dayTicks * config.time.monthDays;
}

export function tickEconomy(world: World): void {
  // End-of-month billing: ranger wages + facility upkeep.
  const mt = monthTicks();
  if (world.tick > 0 && world.tick - world.lastUpkeepBilledAtTick >= mt) {
    const wages = world.rangers.size * config.economy.rangerWagePerMonth;
    let upkeep = 0;
    for (const b of world.buildings.values()) {
      const def = getFacilityDef(b.type);
      if (!def || !b.facility) continue;
      upkeep += def.upkeepPerMonth;
      b.facility.upkeepPaidTotal += def.upkeepPerMonth;
      b.facility.revenueLastMonth = b.facility.revenueThisMonth;
      b.facility.upkeepLastMonth = def.upkeepPerMonth;
      b.facility.revenueThisMonth = 0;
    }
    world.lastUpkeepBilledAtTick = world.tick;
    world.admissionRevenueLastMonth = world.admissionRevenueThisMonth;
    world.admissionRevenueThisMonth = 0;
    if (wages > 0) {
      changeCash(world, -wages, 'ranger wages');
      world.log(`Monthly ranger wages: $${wages}.`);
    }
    if (upkeep > 0) {
      changeCash(world, -upkeep, 'facility upkeep');
      world.log(`Monthly facility upkeep: $${upkeep}.`);
    }
  }
}
