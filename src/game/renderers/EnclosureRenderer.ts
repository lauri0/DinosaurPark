import Phaser from 'phaser';
import { config } from '../../data/config';
import { enclosureBounds, enclosureCentroid } from '../../sim/Enclosures';
import { getSpecies } from '../../data/species';
import type { World } from '../../sim/World';

export class EnclosureRenderer {
  private g: Phaser.GameObjects.Graphics;
  private labels: Map<string, HTMLDivElement> = new Map();
  private uiRoot: HTMLElement;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(-30);
    this.uiRoot = document.getElementById('ui-root')!;
    // Clear any stale labels left over from a previous scene instance.
    for (const el of this.uiRoot.querySelectorAll('.enclosure-label')) el.remove();
  }
  render(world: World, scene: Phaser.Scene): void {
    this.g.clear();
    const cs = config.grid.cellSize;
    const seen = new Set<string>();
    for (const enc of world.enclosures.values()) {
      seen.add(enc.id);
      const { minX, minY, maxX, maxY } = enclosureBounds(enc);
      const x = minX * cs + 4;
      const y = minY * cs + 4;
      const w = (maxX - minX + 1) * cs - 8;
      const h = (maxY - minY + 1) * cs - 8;
      const colorHex = enc.speciesId ? getSpecies(enc.speciesId).color : '#aaaaaa';
      const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
      this.g.fillStyle(color, 0.25);
      this.g.fillRoundedRect(x, y, w, h, 6);
      this.g.lineStyle(2, color, 1);
      this.g.strokeRoundedRect(x, y, w, h, 6);

      // DOM label at centroid. Compute screen coords directly from scroll/zoom
      // (cam.worldView lags by one frame during wheel zoom, causing flicker).
      const cam = scene.cameras.main;
      const cen = enclosureCentroid(enc);
      const wpx = (cen.x + 0.5) * cs;
      const wpy = (cen.y + 0.5) * cs;
      const ccx = cam.width / 2;
      const ccy = cam.height / 2;
      const sx = (wpx - cam.scrollX - ccx) * cam.zoom + ccx;
      const sy = (wpy - cam.scrollY - ccy) * cam.zoom + ccy;
      let div = this.labels.get(enc.id);
      if (!div) {
        div = document.createElement('div');
        div.className = 'enclosure-label';
        this.uiRoot.appendChild(div);
        this.labels.set(enc.id, div);
      }
      div.textContent = enc.speciesId
        ? getSpecies(enc.speciesId).displayName
        : '(empty)';
      div.style.left = `${sx}px`;
      div.style.top = `${sy}px`;
    }
    // Remove stale labels.
    for (const [id, div] of this.labels) {
      if (!seen.has(id)) {
        div.remove();
        this.labels.delete(id);
      }
    }
  }
  destroy(): void {
    for (const div of this.labels.values()) div.remove();
    this.labels.clear();
  }
}
