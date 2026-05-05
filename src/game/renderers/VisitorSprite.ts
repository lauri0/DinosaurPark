import Phaser from 'phaser';
import type { World } from '../../sim/World';

export class VisitorLayer {
  private g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(35);
  }
  render(world: World, alpha: number): void {
    this.g.clear();
    this.g.fillStyle(0xf4ecd8, 1);
    for (const v of world.visitors.values()) {
      const rx = v.prevX + (v.x - v.prevX) * alpha;
      const ry = v.prevY + (v.y - v.prevY) * alpha;
      this.g.fillCircle(rx, ry, 4);
    }
  }
}
