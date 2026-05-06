import Phaser from 'phaser';
import { config } from '../../data/config';
import type { World } from '../../sim/World';

export class VisitorLayer {
  private g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(35);
  }
  render(world: World, alpha: number, selectedId: string | null): void {
    this.g.clear();
    const cs = config.grid.cellSize;

    for (const v of world.visitors.values()) {
      const rx = v.prevX + (v.x - v.prevX) * alpha;
      const ry = v.prevY + (v.y - v.prevY) * alpha;
      const selected = v.id === selectedId;

      if (selected && v.targetCell) {
        // Draw target cell highlight.
        this.g.fillStyle(0x00ff88, 0.35);
        this.g.fillRect(v.targetCell.x * cs, v.targetCell.y * cs, cs, cs);
        this.g.lineStyle(2, 0x00ff88, 0.9);
        this.g.strokeRect(v.targetCell.x * cs, v.targetCell.y * cs, cs, cs);
        // Draw line from visitor to target cell center.
        this.g.lineStyle(1, 0x00ff88, 0.6);
        this.g.beginPath();
        this.g.moveTo(rx, ry);
        this.g.lineTo((v.targetCell.x + 0.5) * cs, (v.targetCell.y + 0.5) * cs);
        this.g.strokePath();
      }

      // Visitor dot.
      if (selected) {
        this.g.fillStyle(0xffffff, 1);
        this.g.fillCircle(rx, ry, 6);
      }
      this.g.fillStyle(0xf4ecd8, 1);
      this.g.fillCircle(rx, ry, selected ? 4 : 4);
    }
  }
}
