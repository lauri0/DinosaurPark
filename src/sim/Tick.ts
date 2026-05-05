import { emit, Events } from '../EventBus';
import { tickEconomy } from './Economy';
import { tickDigSites } from './DigSites';
import { tickHatchery } from './Hatchery';
import { tickDinos } from './Dinos';
import { tickRangers } from './Rangers';
import { tickVisitors } from './Visitors';
import type { World } from './World';

export function simTick(world: World): void {
  world.tick++;
  for (const d of world.dinos.values())    { d.prevX = d.x; d.prevY = d.y; }
  for (const r of world.rangers.values())  { r.prevX = r.x; r.prevY = r.y; }
  for (const v of world.visitors.values()) { v.prevX = v.x; v.prevY = v.y; }
  tickEconomy(world);
  tickDigSites(world);
  tickHatchery(world);
  tickDinos(world);
  tickRangers(world);
  tickVisitors(world);
  emit(Events.TickAdvanced, { tick: world.tick });
}
