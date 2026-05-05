import Phaser from 'phaser';
import { config } from '../../data/config';

export class GridRenderer {
  private g: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Rectangle;
  constructor(scene: Phaser.Scene) {
    const cs = config.grid.cellSize;
    const w = config.grid.cols * cs;
    const h = config.grid.rows * cs;
    this.bg = scene.add.rectangle(0, 0, w, h, 0x7fb069).setOrigin(0, 0).setDepth(-100);
    this.g = scene.add.graphics();
    this.g.lineStyle(1, 0x000000, 0.08);
    for (let x = 0; x <= config.grid.cols; x++) {
      this.g.lineBetween(x * cs, 0, x * cs, h);
    }
    for (let y = 0; y <= config.grid.rows; y++) {
      this.g.lineBetween(0, y * cs, w, y * cs);
    }
    this.g.setDepth(-90);
  }
}
