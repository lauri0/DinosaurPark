import Phaser from 'phaser';
import { config } from '../data/config';
import { World } from '../sim/World';
import { GridRenderer } from './renderers/GridRenderer';
import { PathRenderer } from './renderers/PathRenderer';
import { FenceRenderer } from './renderers/FenceRenderer';
import { BuildingRenderer } from './renderers/BuildingRenderer';
import { EnclosureRenderer } from './renderers/EnclosureRenderer';
import { DinoLayer } from './renderers/DinoSprite';
import { VisitorLayer } from './renderers/VisitorSprite';
import { RangerLayer } from './renderers/RangerSprite';
import { BuildPreview } from './BuildPreview';
import { recomputeEnclosures } from '../sim/Enclosures';
import { invalidateVisitorPathing } from '../sim/Visitors';
import { simTick } from '../sim/Tick';
import { emit, Events, on } from '../EventBus';
import type { BuildMode } from '../sim/types';
import { World as W } from '../sim/World';
import { BUILDINGS, type BuildingType } from '../data/buildings';
import { placeHatchling, cancelCarry } from '../sim/Hatchery';
import { getSpecies } from '../data/species';

export class ParkScene extends Phaser.Scene {
  world!: World;
  private buildMode: BuildMode = 'cursor';
  private gridRenderer!: GridRenderer;
  private pathRenderer!: PathRenderer;
  private fenceRenderer!: FenceRenderer;
  private buildingRenderer!: BuildingRenderer;
  private enclosureRenderer!: EnclosureRenderer;
  private dinoLayer!: DinoLayer;
  private visitorLayer!: VisitorLayer;
  private rangerLayer!: RangerLayer;
  private buildPreview!: BuildPreview;
  private dragging = false;
  private dragErase = false;
  private dragSide: 'N' | 'E' | null = null;
  private dragStartCell: { cx: number; cy: number } | null = null;
  private dragFenceKeys: Set<string> = new Set();
  private accumulator = 0;
  private lerpAlpha = 0;
  private carryDiv: HTMLDivElement | null = null;
  private selectedVisitorId: string | null = null;

  constructor() {
    super('ParkScene');
  }

  init(data: { world?: World } = {}) {
    this.world = data.world ?? new World(Math.floor(Math.random() * 1e9));
    // Mark as global for ui modules.
    (window as unknown as { __world: World }).__world = this.world;
  }

  create() {
    this.gridRenderer = new GridRenderer(this);
    this.pathRenderer = new PathRenderer(this);
    this.enclosureRenderer = new EnclosureRenderer(this);
    this.fenceRenderer = new FenceRenderer(this);
    this.buildingRenderer = new BuildingRenderer(this);
    this.dinoLayer = new DinoLayer(this);
    this.rangerLayer = new RangerLayer(this);
    this.visitorLayer = new VisitorLayer(this);
    this.buildPreview = new BuildPreview(this);

    const cam = this.cameras.main;
    const worldW = config.grid.cols * config.grid.cellSize;
    const worldH = config.grid.rows * config.grid.cellSize;
    cam.setBackgroundColor(0x000000);
    cam.centerOn(worldW / 2, worldH / 2);

    // Soft-clamp the camera center to within world + margin (no Phaser bounds clamping
    // because that re-clamps scroll on zoom changes and breaks zoom-to-cursor math).
    const camMargin = 200;
    const clampCamera = (): void => {
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX, -camMargin - cam.width / 2, worldW + camMargin - cam.width / 2);
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY, -camMargin - cam.height / 2, worldH + camMargin - cam.height / 2);
    };

    // Pan with middle/right mouse.
    let panAnchor: { x: number; y: number; sx: number; sy: number } | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 1 || p.button === 2) {
        panAnchor = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.button === 1 || p.button === 2) {
        panAnchor = null;
        this.dragging = false;
      }
      if (p.button === 0) {
        if (this.dragging && this.dragFenceKeys.size > 0) {
          recomputeEnclosures(this.world);
          invalidateVisitorPathing();
          emit(Events.FenceToggled, { edgeKey: '' });
          this.dragFenceKeys.clear();
        }
        this.dragging = false;
        this.dragSide = null;
        this.dragStartCell = null;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (panAnchor) {
        cam.scrollX = panAnchor.sx - (p.x - panAnchor.x) / cam.zoom;
        cam.scrollY = panAnchor.sy - (p.y - panAnchor.y) / cam.zoom;
        clampCamera();
      }
      // Build-mode drag.
      if (this.dragging && p.leftButtonDown()) {
        const isFenceDrag = !this.dragErase && (this.buildMode === 'fence' || this.buildMode === 'gate') && this.dragSide && this.dragStartCell;
        if (isFenceDrag) {
          const { cx, cy } = this.cellAndEdgeAt(p);
          this.applyFenceLine(cx, cy);
        } else {
          this.applyAtPointer(p, this.dragErase);
        }
      }
      // Carry cursor.
      if (this.buildMode === 'carry' && this.carryDiv) {
        this.carryDiv.style.left = `${p.x}px`;
        this.carryDiv.style.top = `${p.y}px`;
      }
    });

    // Wheel zoom — keep world point under pointer fixed.
    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
        const factor = dy > 0 ? 0.9 : 1.1;
        const oldZoom = cam.zoom;
        const newZoom = Phaser.Math.Clamp(oldZoom * factor, config.camera.minZoom, config.camera.maxZoom);
        if (newZoom === oldZoom) return;
        const ptr = this.input.activePointer;
        // World point under cursor BEFORE zoom (camera origin is 0.5 by default).
        const cx = cam.width / 2;
        const cy = cam.height / 2;
        const wx = cam.scrollX + (ptr.x - cx) / oldZoom + cx;
        const wy = cam.scrollY + (ptr.y - cy) / oldZoom + cy;
        cam.zoom = newZoom;
        // Solve scroll so the same world point lands under the cursor.
        cam.scrollX = wx - (ptr.x - cx) / newZoom - cx;
        cam.scrollY = wy - (ptr.y - cy) / newZoom - cy;
        clampCamera();
      },
    );

    // Block default browser context menu so right-click pans cleanly.
    this.input.mouse?.disableContextMenu();

    // Left-click handling for building / path / fence placement.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button !== 0 && p.button !== 2) return;
      const erase = p.button === 2;
      if (erase && (this.buildMode === 'cursor' || this.buildMode === 'carry')) return;
      if (this.buildMode === 'cursor') {
        this.trySelectVisitor(p);
        return;
      }
      if (this.buildMode === 'carry') {
        if (p.button === 0) this.tryPlaceCarry(p);
        return;
      }
      this.dragging = true;
      this.dragErase = erase;
      // Capture straight-line fence drag direction.
      if (!erase && (this.buildMode === 'fence' || this.buildMode === 'gate')) {
        const { cx, cy, side } = this.cellAndEdgeAt(p);
        this.dragSide = (side === 'N' || side === 'S') ? 'N' : 'E';
        this.dragStartCell = { cx, cy };
        this.dragFenceKeys.clear();
        this.applyFenceLine(cx, cy);
      } else {
        this.dragSide = null;
        this.dragStartCell = null;
        this.applyAtPointer(p, erase);
      }
    });

    // EventBus subscriptions.
    on<{ mode: BuildMode }>(Events.BuildModeChanged, ({ mode }) => {
      this.setBuildMode(mode);
    });
    on(Events.HatchPickedUp, () => {
      const h = this.world.pendingHatchlings.find((x) => x.id === this.world.carryHatchlingId);
      if (h) {
        this.setBuildMode('carry');
        this.showCarryCursor(h.speciesId);
      }
    });

    // Esc cancels build mode / carry.
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.buildMode === 'carry') {
        cancelCarry(this.world);
        this.hideCarryCursor();
      }
      this.setBuildMode('cursor');
      emit(Events.BuildModeChanged, { mode: 'cursor' });
    });

    // Ctrl+S save.
    this.input.keyboard?.on('keydown-S', (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        emit(Events.SaveRequested, null);
      }
    });

    recomputeEnclosures(this.world);
    this.renderAll();
  }

  private setBuildMode(mode: BuildMode): void {
    this.buildMode = mode;
    if (mode !== 'carry') this.hideCarryCursor();
  }

  private showCarryCursor(speciesId: string): void {
    if (this.carryDiv) this.carryDiv.remove();
    const div = document.createElement('div');
    div.className = 'carry-cursor';
    div.style.background = getSpecies(speciesId).color;
    document.getElementById('ui-root')!.appendChild(div);
    this.carryDiv = div;
  }
  private hideCarryCursor(): void {
    if (this.carryDiv) {
      this.carryDiv.remove();
      this.carryDiv = null;
    }
  }

  private tryPlaceCarry(p: Phaser.Input.Pointer): void {
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const cs = config.grid.cellSize;
    const cx = Math.floor(wp.x / cs);
    const cy = Math.floor(wp.y / cs);
    const err = placeHatchling(this.world, cx, cy);
    if (err) {
      emit(Events.ToastError, { msg: err });
    } else {
      this.hideCarryCursor();
      this.setBuildMode('cursor');
      emit(Events.BuildModeChanged, { mode: 'cursor' });
      recomputeEnclosures(this.world);
    }
  }

  private cellAndEdgeAt(p: Phaser.Input.Pointer): {
    cx: number;
    cy: number;
    side: 'N' | 'E' | 'S' | 'W';
  } {
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const cs = config.grid.cellSize;
    const cx = Math.floor(wp.x / cs);
    const cy = Math.floor(wp.y / cs);
    // Which edge is closest?
    const fx = wp.x / cs - cx; // 0..1 inside cell
    const fy = wp.y / cs - cy;
    const distN = fy;
    const distS = 1 - fy;
    const distW = fx;
    const distE = 1 - fx;
    const min = Math.min(distN, distS, distW, distE);
    let side: 'N' | 'E' | 'S' | 'W' = 'N';
    if (min === distS) side = 'S';
    else if (min === distW) side = 'W';
    else if (min === distE) side = 'E';
    return { cx, cy, side };
  }

  private applyBulldoze(cx: number, cy: number, side: 'N' | 'E' | 'S' | 'W'): void {
    let changed = false;
    // Priority: building → path → nearest fence/gate edge.
    const cell = this.world.cell(cx, cy);
    if (!cell) return;
    if (cell.buildingId) {
      this.world.removeBuilding(cell.buildingId);
      invalidateVisitorPathing();
      changed = true;
    } else if (cell.isPath) {
      this.world.togglePath(cx, cy, false);
      invalidateVisitorPathing();
      changed = true;
    } else {
      // Remove the nearest fence or gate edge.
      const k = W.edgeKey(cx, cy, side);
      if (this.world.fenceEdges.has(k) || this.world.gateEdges.has(k)) {
        this.world.fenceEdges.delete(k);
        this.world.gateEdges.delete(k);
        changed = true;
      }
    }
    if (changed) {
      recomputeEnclosures(this.world);
    }
  }

  private applyAtPointer(p: Phaser.Input.Pointer, erase: boolean): void {
    const { cx, cy, side } = this.cellAndEdgeAt(p);
    if (!this.world.inBounds(cx, cy)) return;
    if (this.buildMode === 'bulldoze') {
      this.applyBulldoze(cx, cy, side);
      return;
    }
    if (this.buildMode === 'path') {
      this.world.togglePath(cx, cy, !erase);
      emit(Events.PathToggled, { x: cx, y: cy });
      invalidateVisitorPathing();
      return;
    }
    if (this.buildMode === 'fence') {
      const k = W.edgeKey(cx, cy, side);
      // Disallow placing fence across a building cell-edge boundary if both cells are
      // inside a building's footprint — keeps things sane.
      if (!erase) this.world.toggleFence(k, true);
      else {
        this.world.fenceEdges.delete(k);
        this.world.gateEdges.delete(k);
      }
      emit(Events.FenceToggled, { edgeKey: k });
      recomputeEnclosures(this.world);
      invalidateVisitorPathing();
      return;
    }
    if (this.buildMode === 'gate') {
      const k = W.edgeKey(cx, cy, side);
      if (!erase) this.world.toggleGate(k, true);
      else {
        this.world.fenceEdges.delete(k);
        this.world.gateEdges.delete(k);
      }
      recomputeEnclosures(this.world);
      invalidateVisitorPathing();
      return;
    }
    if (this.buildMode.startsWith('building:')) {
      if (erase) return;
      const type = this.buildMode.slice('building:'.length) as BuildingType;
      const def = BUILDINGS[type];
      if (!this.world.canPlaceBuilding(type, cx, cy)) return;
      if (this.world.cash < def.cost) {
        emit(Events.ToastError, { msg: `Not enough cash ($${def.cost} required).` });
        return;
      }
      const b = this.world.placeBuilding(type, cx, cy);
      if (b) {
        this.world.cash -= def.cost;
        emit(Events.CashChanged, { cash: this.world.cash, delta: -def.cost, reason: 'build' });
        emit(Events.BuildingPlaced, b);
        this.world.log(`${BUILDINGS[type].displayName} placed.`);
        invalidateVisitorPathing();
        // After placing, exit building mode (one-shot).
        this.setBuildMode('cursor');
        emit(Events.BuildModeChanged, { mode: 'cursor' });
      }
      return;
    }
  }

  private trySelectVisitor(p: Phaser.Input.Pointer): void {
    const cam = this.cameras.main;
    const wp = cam.getWorldPoint(p.x, p.y);
    const cs = config.grid.cellSize;
    const cx = Math.floor(wp.x / cs);
    const cy = Math.floor(wp.y / cs);
    const cell = this.world.cell(cx, cy);
    console.log(`[Click] cell (${cx},${cy})`, {
      isPath: cell?.isPath,
      buildingId: cell?.buildingId ?? null,
      enclosureId: cell?.enclosureId ?? null,
    });

    const pickRadius = 12 / cam.zoom;
    // Dinos take precedence over visitors when overlapping.
    let bestDino: { id: string; dist: number } | null = null;
    for (const d of this.world.dinos.values()) {
      const dist = Math.hypot(d.x - wp.x, d.y - wp.y);
      if (dist < pickRadius && (!bestDino || dist < bestDino.dist)) {
        bestDino = { id: d.id, dist };
      }
    }
    if (bestDino) {
      this.selectedVisitorId = null;
      emit(Events.DinoClicked, { dinoId: bestDino.id });
      return;
    }

    let best: { id: string; dist: number } | null = null;
    for (const v of this.world.visitors.values()) {
      const dist = Math.hypot(v.x - wp.x, v.y - wp.y);
      if (dist < pickRadius && (!best || dist < best.dist)) {
        best = { id: v.id, dist };
      }
    }
    const v = best ? this.world.visitors.get(best.id) : null;
    if (v) {
      this.selectedVisitorId = v.id;
      console.log('[Visitor inspect]', {
        id: v.id,
        state: v.state,
        pos: `(${Math.floor(v.x / cs)}, ${Math.floor(v.y / cs)})`,
        target: v.targetCell ? `(${v.targetCell.x}, ${v.targetCell.y})` : 'none',
        pathLen: v.path.length,
        pathIdx: v.pathIdx,
        idleRemaining: v.viewIdleRemaining,
        enclosuresViewed: v.enclosuresViewed,
      });
    } else {
      this.selectedVisitorId = null;
    }
  }

  private applyFenceLine(cxEnd: number, cyEnd: number): void {
    const isGate = this.buildMode === 'gate';
    // Remove edges added by this drag segment.
    for (const k of this.dragFenceKeys) {
      this.world.fenceEdges.delete(k);
      this.world.gateEdges.delete(k);
    }
    this.dragFenceKeys.clear();
    if (!this.dragStartCell || !this.dragSide) return;
    // Draw straight line from start to current position.
    if (this.dragSide === 'N') {
      const cy = this.dragStartCell.cy;
      const x0 = Math.min(this.dragStartCell.cx, cxEnd);
      const x1 = Math.max(this.dragStartCell.cx, cxEnd);
      for (let cx = x0; cx <= x1; cx++) {
        if (!this.world.inBounds(cx, cy)) continue;
        const k = W.edgeKey(cx, cy, 'N');
        if (!this.world.fenceEdges.has(k) && !this.world.gateEdges.has(k)) {
          if (isGate) this.world.gateEdges.add(k);
          else this.world.fenceEdges.add(k);
          this.dragFenceKeys.add(k);
        }
      }
    } else {
      const cx = this.dragStartCell.cx;
      const y0 = Math.min(this.dragStartCell.cy, cyEnd);
      const y1 = Math.max(this.dragStartCell.cy, cyEnd);
      for (let cy = y0; cy <= y1; cy++) {
        if (!this.world.inBounds(cx, cy)) continue;
        const k = W.edgeKey(cx, cy, 'E');
        if (!this.world.fenceEdges.has(k) && !this.world.gateEdges.has(k)) {
          if (isGate) this.world.gateEdges.add(k);
          else this.world.fenceEdges.add(k);
          this.dragFenceKeys.add(k);
        }
      }
    }
  }

  update(_t: number, dt: number): void {
    const speed = this.world.timeSpeed;
    if (speed > 0) {
      this.accumulator += dt * speed;
      while (this.accumulator >= config.time.tickMs) {
        simTick(this.world);
        this.accumulator -= config.time.tickMs;
      }
      this.lerpAlpha = this.accumulator / config.time.tickMs;
    } else {
      this.lerpAlpha = 1;
    }
    this.renderAll();
  }

  private renderAll(): void {
    this.pathRenderer.render(this.world);
    this.enclosureRenderer.render(this.world, this);
    this.fenceRenderer.render(this.world);
    this.buildingRenderer.render(this.world, (b) => {
      if (this.buildMode !== 'cursor') return;
      if (b.type === 'Feeder') emit(Events.FeederClicked, { buildingId: b.id });
      else if (b.type === 'RangerStation') emit(Events.RangerStationClicked, { buildingId: b.id });
      else if (b.type === 'FossilCentre') emit(Events.FossilCentreClicked, { buildingId: b.id });
      else if (b.type === 'Hatchery') emit(Events.HatcheryClicked, { buildingId: b.id });
      else if (b.type === 'EntranceGate') emit(Events.EntranceGateClicked, { buildingId: b.id });
    });
    this.dinoLayer.render(this.world, this.lerpAlpha);
    this.rangerLayer.render(this.world, this.lerpAlpha);
    this.visitorLayer.render(this.world, this.lerpAlpha, this.selectedVisitorId);

    // Build preview.
    const p = this.input.activePointer;
    if (p && this.buildMode !== 'cursor') {
      const { cx, cy, side } = this.cellAndEdgeAt(p);
      this.buildPreview.render(this.buildMode, this.world, cx, cy, side);
    } else {
      this.buildPreview.render('cursor', this.world, 0, 0, null);
    }
  }
}
