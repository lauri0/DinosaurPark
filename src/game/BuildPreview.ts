import Phaser from 'phaser';
import { config } from '../data/config';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import type { World } from '../sim/World';
import type { BuildMode } from '../sim/types';

export class BuildPreview {
  private g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(60);
  }

  render(mode: BuildMode, world: World, cellX: number, cellY: number, edgeSide: 'N' | 'E' | 'S' | 'W' | null): void {
    this.g.clear();
    const cs = config.grid.cellSize;
    if (mode === 'cursor') return;
    if (mode === 'carry') {
      const c = world.cell(cellX, cellY);
      const ok = !!c?.enclosureId;
      this.g.fillStyle(ok ? 0x33ff66 : 0xff4444, 0.35);
      this.g.fillRect(cellX * cs, cellY * cs, cs, cs);
      return;
    }
    if (mode === 'bulldoze') {
      const c = world.cell(cellX, cellY);
      if (!c) return;
      // Highlight the building footprint if a building is present.
      if (c.buildingId) {
        const b = world.buildings.get(c.buildingId);
        if (b) {
          this.g.fillStyle(0xff4444, 0.4);
          this.g.fillRect(b.x * cs, b.y * cs, b.width * cs, b.height * cs);
          this.g.lineStyle(2, 0xff4444, 0.9);
          this.g.strokeRect(b.x * cs, b.y * cs, b.width * cs, b.height * cs);
          return;
        }
      }
      // Highlight the cell.
      this.g.fillStyle(0xff4444, 0.35);
      this.g.fillRect(cellX * cs, cellY * cs, cs, cs);
      // Also highlight the nearest fence/gate edge.
      if (edgeSide) {
        const k = `${cellX},${cellY},${edgeSide === 'S' ? `${cellX},${cellY + 1},N` : edgeSide === 'W' ? `${cellX - 1},${cellY},E` : edgeSide}`;
        void k; // preview without key lookup is fine — just show nearest edge highlight
        this.g.lineStyle(4, 0xff8800, 0.9);
        this.drawEdge(cellX, cellY, edgeSide);
      }
      return;
    }
    if (mode === 'path') {
      const c = world.cell(cellX, cellY);
      const ok = !!c && !c.buildingId;
      this.g.fillStyle(ok ? 0x33ff66 : 0xff4444, 0.35);
      this.g.fillRect(cellX * cs, cellY * cs, cs, cs);
      return;
    }
    if (mode === 'fence' || mode === 'gate') {
      if (!edgeSide) return;
      this.g.lineStyle(4, mode === 'gate' ? 0xffd166 : 0x33ff66, 0.85);
      this.drawEdge(cellX, cellY, edgeSide);
      return;
    }
    if (mode.startsWith('building:')) {
      const type = mode.slice('building:'.length) as BuildingType;
      const def = BUILDINGS[type];
      const ok = world.canPlaceBuilding(type, cellX, cellY);
      this.g.fillStyle(ok ? 0x33ff66 : 0xff4444, 0.35);
      this.g.fillRect(cellX * cs, cellY * cs, def.width * cs, def.height * cs);
      this.g.lineStyle(2, ok ? 0x33ff66 : 0xff4444, 0.9);
      this.g.strokeRect(cellX * cs, cellY * cs, def.width * cs, def.height * cs);
    }
  }

  private drawEdge(x: number, y: number, side: 'N' | 'E' | 'S' | 'W'): void {
    const cs = config.grid.cellSize;
    const px = x * cs, py = y * cs;
    if (side === 'N') this.g.lineBetween(px, py, px + cs, py);
    else if (side === 'S') this.g.lineBetween(px, py + cs, px + cs, py + cs);
    else if (side === 'E') this.g.lineBetween(px + cs, py, px + cs, py + cs);
    else this.g.lineBetween(px, py, px, py + cs);
  }
}
