import Phaser from 'phaser';
import type { World } from '../../sim/World';

export class RangerLayer {
  private g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(38);
  }
  render(world: World, alpha: number): void {
    this.g.clear();
    this.g.fillStyle(0x3a3a3a, 1);
    this.g.lineStyle(1.5, 0x90c890, 0.9);
    for (const r of world.rangers.values()) {
      const rx = r.prevX + (r.x - r.prevX) * alpha;
      const ry = r.prevY + (r.y - r.prevY) * alpha;
      this.g.fillCircle(rx, ry, 5);
      this.g.strokeCircle(rx, ry, 6);
    }
  }
}
