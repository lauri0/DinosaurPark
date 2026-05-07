import Phaser from 'phaser';
import { config } from '../../data/config';
import type { World } from '../../sim/World';

export class PoopLayer {
  private g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    // Above building footprints (depth ~10) and dino rendering layer baseline,
    // but below moving sprites so dinos visibly walk over poop.
    this.g = scene.add.graphics().setDepth(35);
  }
  render(world: World): void {
    this.g.clear();
    if (world.poops.size === 0) return;
    const cs = config.grid.cellSize;
    this.g.fillStyle(0x6b4423, 1);
    this.g.lineStyle(1, 0x3d2614, 0.9);
    for (const p of world.poops.values()) {
      const cx = (p.x + 0.5) * cs;
      const cy = (p.y + 0.5) * cs;
      this.g.fillCircle(cx, cy, 3);
      this.g.strokeCircle(cx, cy, 3);
    }
  }
}
