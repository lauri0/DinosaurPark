import Phaser from 'phaser';
import { config } from '../../data/config';
import type { World } from '../../sim/World';

export class FenceRenderer {
  private g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(20);
  }
  render(world: World): void {
    this.g.clear();
    const cs = config.grid.cellSize;
    const fenceColor = 0x3a2a1a;
    const gateColor = 0x9a7a3a;

    this.g.lineStyle(3, fenceColor, 1);
    for (const k of world.fenceEdges) {
      const [xs, ys, side] = k.split(',');
      const x = Number(xs), y = Number(ys);
      const px = x * cs, py = y * cs;
      if (side === 'N') this.g.lineBetween(px, py, px + cs, py);
      else if (side === 'E') this.g.lineBetween(px + cs, py, px + cs, py + cs);
    }

    // Posts at fence corners.
    this.g.fillStyle(0x1a0e08, 1);
    const corners = new Set<string>();
    for (const k of world.fenceEdges) {
      const [xs, ys, side] = k.split(',');
      const x = Number(xs), y = Number(ys);
      if (side === 'N') {
        corners.add(`${x},${y}`);
        corners.add(`${x + 1},${y}`);
      } else {
        corners.add(`${x + 1},${y}`);
        corners.add(`${x + 1},${y + 1}`);
      }
    }
    for (const c of corners) {
      const [xs, ys] = c.split(',');
      this.g.fillCircle(Number(xs) * cs, Number(ys) * cs, 2.5);
    }

    // Gates.
    this.g.lineStyle(3, gateColor, 1);
    for (const k of world.gateEdges) {
      const [xs, ys, side] = k.split(',');
      const x = Number(xs), y = Number(ys);
      const px = x * cs, py = y * cs;
      if (side === 'N') {
        // Two posts only.
        this.g.fillStyle(gateColor, 1);
        this.g.fillCircle(px, py, 4);
        this.g.fillCircle(px + cs, py, 4);
      } else {
        this.g.fillStyle(gateColor, 1);
        this.g.fillCircle(px + cs, py, 4);
        this.g.fillCircle(px + cs, py + cs, 4);
      }
    }
  }
}
