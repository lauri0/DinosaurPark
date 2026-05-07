import Phaser from 'phaser';
import { config } from '../../data/config';
import { BUILDINGS, type BuildingType } from '../../data/buildings';
import { stationServiceBounds } from '../../sim/StaffPathing';
import type { World } from '../../sim/World';
import type { Building } from '../../sim/types';

const COLORS: Record<BuildingType, number> = {
  EntranceGate: 0x5a4632,
  Feeder: 0xa8743a,
  RangerStation: 0x3a4a6a,
  FossilCentre: 0x6a4a8a,
  Hatchery: 0x8a6a3a,
  DrinkStand: 0x3a8a8a,
};

export class BuildingRenderer {
  private rangeG: Phaser.GameObjects.Graphics;
  private g: Phaser.GameObjects.Graphics;
  private hitZones: Map<string, Phaser.GameObjects.Zone> = new Map();
  private hoveredBuildingId: string | null = null;
  constructor(private scene: Phaser.Scene) {
    // Range overlay sits below buildings so the building body draws on top.
    this.rangeG = scene.add.graphics().setDepth(9);
    this.g = scene.add.graphics().setDepth(10);
  }

  render(world: World, onClick: (b: Building) => void): void {
    this.g.clear();
    this.rangeG.clear();
    // Remove stale hit zones.
    for (const [id, z] of this.hitZones) {
      if (!world.buildings.has(id)) {
        z.destroy();
        this.hitZones.delete(id);
        if (this.hoveredBuildingId === id) this.hoveredBuildingId = null;
      }
    }
    // Draw service-range overlay for the hovered ranger station.
    if (this.hoveredBuildingId) {
      const hovered = world.buildings.get(this.hoveredBuildingId);
      if (hovered && hovered.type === 'RangerStation') {
        const range = BUILDINGS.RangerStation.serviceRange ?? 0;
        if (range > 0) {
          const cs = config.grid.cellSize;
          const bnds = stationServiceBounds(hovered, range);
          const x = bnds.minX * cs;
          const y = bnds.minY * cs;
          const w = (bnds.maxX - bnds.minX + 1) * cs;
          const h = (bnds.maxY - bnds.minY + 1) * cs;
          this.rangeG.fillStyle(0x4ec3ff, 0.12);
          this.rangeG.fillRect(x, y, w, h);
          this.rangeG.lineStyle(2, 0x4ec3ff, 0.7);
          this.rangeG.strokeRect(x + 1, y + 1, w - 2, h - 2);
        }
      }
    }
    const cs = config.grid.cellSize;
    for (const b of world.buildings.values()) {
      const px = b.x * cs;
      const py = b.y * cs;
      const w = b.width * cs;
      const h = b.height * cs;
      this.g.fillStyle(COLORS[b.type], 1);
      this.g.fillRoundedRect(px + 2, py + 2, w - 4, h - 4, 4);
      this.g.lineStyle(2, 0x000000, 0.4);
      this.g.strokeRoundedRect(px + 2, py + 2, w - 4, h - 4, 4);
      drawGlyph(this.g, BUILDINGS[b.type].glyph, px + w / 2, py + h / 2, Math.min(w, h) * 0.35);
      if (b.type === 'Feeder') {
        // Food bar.
        const food = b.food ?? 0;
        const cap = config.feeder.capacity;
        this.g.fillStyle(0x000000, 0.4);
        this.g.fillRect(px + 4, py + h - 6, w - 8, 4);
        this.g.fillStyle(food > cap * 0.3 ? 0x4cd964 : 0xf2a93a, 1);
        this.g.fillRect(px + 4, py + h - 6, (w - 8) * (food / cap), 4);
      }
      if (!this.hitZones.has(b.id)) {
        const z = this.scene.add
          .zone(px, py, w, h)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        z.on('pointerdown', (ev: Phaser.Input.Pointer) => {
          if (ev.button !== 0) return;
          // Skip if any build mode is active — handled by ParkScene-level guard.
          onClick(b);
        });
        z.on('pointerover', () => {
          this.hoveredBuildingId = b.id;
        });
        z.on('pointerout', () => {
          if (this.hoveredBuildingId === b.id) this.hoveredBuildingId = null;
        });
        this.hitZones.set(b.id, z);
      } else {
        const z = this.hitZones.get(b.id)!;
        z.setPosition(px, py);
        z.setSize(w, h);
        z.input!.hitArea.setTo(0, 0, w, h);
      }
    }
  }
}

export function drawGlyph(
  g: Phaser.GameObjects.Graphics,
  kind: 'gate' | 'flask' | 'cross' | 'bone' | 'egg' | 'cup',
  cx: number,
  cy: number,
  size: number,
): void {
  g.lineStyle(2.5, 0xffffff, 0.95);
  g.fillStyle(0xffffff, 0.95);
  switch (kind) {
    case 'gate':
      g.lineBetween(cx - size, cy + size * 0.6, cx - size, cy - size * 0.6);
      g.lineBetween(cx + size, cy + size * 0.6, cx + size, cy - size * 0.6);
      g.lineBetween(cx - size, cy - size * 0.4, cx + size, cy - size * 0.4);
      break;
    case 'flask':
      g.lineBetween(cx - size * 0.5, cy - size, cx - size * 0.5, cy);
      g.lineBetween(cx + size * 0.5, cy - size, cx + size * 0.5, cy);
      g.lineBetween(cx - size * 0.5, cy, cx - size, cy + size);
      g.lineBetween(cx + size * 0.5, cy, cx + size, cy + size);
      g.lineBetween(cx - size, cy + size, cx + size, cy + size);
      break;
    case 'cross':
      g.fillRect(cx - size * 0.25, cy - size, size * 0.5, size * 2);
      g.fillRect(cx - size, cy - size * 0.25, size * 2, size * 0.5);
      break;
    case 'bone':
      g.fillCircle(cx - size * 0.7, cy - size * 0.5, size * 0.3);
      g.fillCircle(cx + size * 0.7, cy + size * 0.5, size * 0.3);
      g.lineBetween(cx - size * 0.5, cy - size * 0.4, cx + size * 0.5, cy + size * 0.4);
      break;
    case 'egg':
      g.fillEllipse(cx, cy, size * 1.2, size * 1.6);
      break;
    case 'cup':
      g.lineBetween(cx - size * 0.6, cy - size * 0.7, cx - size * 0.4, cy + size * 0.8);
      g.lineBetween(cx + size * 0.6, cy - size * 0.7, cx + size * 0.4, cy + size * 0.8);
      g.lineBetween(cx - size * 0.4, cy + size * 0.8, cx + size * 0.4, cy + size * 0.8);
      g.lineBetween(cx - size * 0.6, cy - size * 0.7, cx + size * 0.6, cy - size * 0.7);
      g.strokeCircle(cx + size * 0.75, cy, size * 0.3);
      break;
  }
}
