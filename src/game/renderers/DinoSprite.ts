import Phaser from 'phaser';
import { config } from '../../data/config';
import type { World } from '../../sim/World';
import { getSpecies } from '../../data/species';

export class DinoLayer {
  private g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(40);
  }
  render(world: World, alpha: number): void {
    this.g.clear();
    for (const d of world.dinos.values()) {
      const rx = d.prevX + (d.x - d.prevX) * alpha;
      const ry = d.prevY + (d.y - d.prevY) * alpha;
      const sp = getSpecies(d.speciesId);
      const color = Phaser.Display.Color.HexStringToColor(sp.color).color;
      this.g.fillStyle(color, 1);
      this.g.lineStyle(2, 0x000000, 0.5);
      this.g.fillCircle(rx, ry, 10);
      this.g.strokeCircle(rx, ry, 10);
      // Health/satiation indicator: ring color shifts when starving.
      if (d.satiation < config.dinos.eatTriggerSatiation) {
        this.g.lineStyle(2, 0xffaa00, 0.9);
        this.g.strokeCircle(rx, ry, 12);
      }
      if (d.health < 100) {
        this.g.lineStyle(2, 0xff3333, 0.9);
        this.g.strokeCircle(rx, ry, 14);
      }
    }
  }
}
