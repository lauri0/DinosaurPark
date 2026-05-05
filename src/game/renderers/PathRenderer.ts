import Phaser from 'phaser';
import { config } from '../../data/config';
import type { World } from '../../sim/World';

export class PathRenderer {
  private g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(-50);
  }
  render(world: World): void {
    this.g.clear();
    const cs = config.grid.cellSize;
    this.g.fillStyle(0xc8b88c, 1);
    for (let y = 0; y < config.grid.rows; y++) {
      for (let x = 0; x < config.grid.cols; x++) {
        if (world.cells[y]![x]!.isPath) {
          this.g.fillRect(x * cs + 2, y * cs + 2, cs - 4, cs - 4);
        }
      }
    }
  }
}
