# Dinosaur Park Builder — MVP Spec

This spec defines the scope for the first playable version. It builds on `dino-park-builder.md` but supersedes it where they conflict. Anything not listed here is **out of scope** for the MVP. Items flagged **[GUESS]** are reasonable defaults filled in by the author of this spec; expect to revisit.

---

## 1. MVP Scope

### Core loop (in scope)
**Place dig site team → wait for haul → extract DNA at Fossil Centre → accumulate to ≥50% → hatch in Hatchery → pick up hatchling → place into a fenced enclosure → visitors arrive via entrance → income ticks → spend on more expeditions, fences, feeders, rangers.**

### In scope
- Fixed 80×60 grid, 32px cells, pannable + zoomable camera
- Terrain: grass background; black void beyond map edges
- Click-drag placement: paths (along cells), fences (along cell edges)
- Building palette with placement preview + grid snap
- Buildings: Entrance Gate, Feeder, Ranger Station, Fossil Centre, Hatchery
- Enclosure detection via fence flood-fill from a placed Gate edge piece
- 3 dinosaur species: Allosaurus, Stegosaurus, Utahraptor (data-driven, easy to add more)
- 9 dig sites (data-driven). 1 unlocked at start; others purchasable for escalating cash cost (replaces the rating-gated unlock for MVP — see §11)
- Expedition timer + haul resolution UI (extract vs sell per fossil)
- DNA Manager (per-species %, capped at 100%, non-consumed on hatch)
- Hatchery: hatch when a species ≥50% DNA; produces a "hatchling" cursor mode for placement
- Hunger → health → death loop (no other needs in MVP)
- Rangers: walk from Ranger Station to feeders that need refilling, then to enclosures with hungry dinos
- Visitors: spawn at Entrance Gate based on entry fee + dino count (no rating); A* along paths to nearest viewable enclosure; pay admission on entry; despawn at gate after viewing N enclosures
- Income/expenses tick + cash readout
- Player-adjustable admission price slider
- Persistent notification log panel
- Manual save/load (single slot) + launch screen with New Game / Load Game / Continue
- Pause / 1× / 2× / 3× time controls

### Out of scope (stubbed or removed)
- Park rating / star system
- Research tree, vet clinic, viewing gallery, gift shop, restroom, power generator
- Escape events, security, fence-breach logic
- Coexistence rules, happiness, social/group needs, paleoflora
- Fossil market (purchasing fossils with cash)
- Vets, workers, named-staff hiring screen for non-rangers
- Audio
- Touch / mobile input
- Multiple save slots, autosave, cloud sync
- Taxes, building maintenance
- Dinosaur lifespan / aging / death from old age (MVP: dinos only die from starvation)
- Dinosaur appeal stars (every dino has equal pull on visitors in MVP)

---

## 2. Tech & Project Structure

Tech stack matches the overview: **Phaser 3 + TypeScript + Vite + easystarjs + Vanilla HTML/CSS UI + localStorage**.

```
/src
  /game             Phaser scenes & rendering
    ParkScene.ts
    BootScene.ts
    BuildPreview.ts
    renderers/
      TerrainRenderer.ts
      GridRenderer.ts
      EnclosureRenderer.ts
      FenceRenderer.ts
      PathRenderer.ts
      BuildingRenderer.ts
      DinoSprite.ts
      VisitorSprite.ts
      RangerSprite.ts
  /sim              Headless game state (no Phaser deps)
    World.ts        2D cell array + accessors
    Enclosures.ts   flood-fill, species assignment
    Dinos.ts        hunger/health update, wander targets
    Visitors.ts     spawn cadence, A* request, view loop
    Rangers.ts      task assignment
    Economy.ts      cash, income/expense ticks
    DigSites.ts     unlock state, expedition timers, haul roll
    DNA.ts          per-species accumulation
    Hatchery.ts     pending hatchlings
    Save.ts         JSON serialize/deserialize
    Tick.ts         the single tick(dt) entry point
  /ui               DOM panels & overlays
    HUD.ts
    BuildPalette.ts
    DigSitesPanel.ts
    HaulModal.ts
    DNAPanel.ts
    HatcheryPanel.ts
    EnclosurePanel.ts (placement-only in MVP)
    RangerPanel.ts
    NotificationLog.ts
    LaunchScreen.ts
    SettingsPanel.ts (admission slider + save/load)
  /data             JSON / TS data tables
    species.ts
    digSites.ts
    buildings.ts
    config.ts       balance constants (see §15)
  /assets
    /portraits      <species>.png  (optional; stubbed if missing)
  EventBus.ts
  main.ts
  index.html
  style.css
```

**Sim/render split.** `/sim` modules are pure TypeScript with no Phaser imports. `ParkScene` reads from sim each frame and updates renderers/sprites. UI panels read from sim and emit user-intent events. This makes save/load and headless tests trivial.

---

## 3. Coordinate System & Camera

- World grid: 80 columns × 60 rows. Cell = 32×32 px. World pixel size: 2560×1920.
- World origin (0,0) at top-left cell.
- Map background fill: `#7FB069` (muted grass green) [GUESS]. Off-map void: `#000`.
- Camera: middle-mouse drag or right-mouse drag to pan; mouse wheel to zoom (0.5× to 2×). Camera clamped so the map cannot leave the viewport on the screen-fitting axis.
- Grid lines: 1px, `rgba(0,0,0,0.08)` [GUESS], drawn in front of terrain, behind everything else.

---

## 4. World State (Cell Grid)

```ts
type CellTerrain = 'grass';        // only one type in MVP
type EdgeFlag = 0 | 1;

interface Cell {
  terrain: CellTerrain;
  buildingId: string | null;
  isPath: boolean;
  fenceN: EdgeFlag; fenceE: EdgeFlag; fenceS: EdgeFlag; fenceW: EdgeFlag;
  enclosureId: string | null;       // assigned by flood-fill after fence change
  walkableForVisitors: boolean;     // true on path cells + entrance + adjacent viewing cells
  walkableForRangers: boolean;      // true on grass + path + inside enclosures (rangers can enter)
}
```

Fences are stored on cell edges. To avoid double-storage, the canonical store is:

```ts
const fenceEdges = new Set<string>();   // key: "x,y,N" | "x,y,E"
```

We only persist N and E edges; the S edge of (x,y) is the N edge of (x,y+1), etc. Cell-side flags are derived for fast renderer lookup.

---

## 5. Placement & Build Mode

The toolbar (left side) lists modes:

- **Cursor** (default) — clicking selects buildings, dinos, enclosures
- **Path** — click-drag along cells to mark `isPath = true`. Drag erases on right-click.
- **Fence** — click-drag along the **nearest cell edge** under the cursor (snap to edge). Right-click drag removes.
- **Gate** — special fence segment; placed on a single edge. Visually a gap in the fence with two posts. A gate edge is *not* a fence (visitors/rangers can cross it) but **counts as boundary** for enclosure flood-fill.
- **Building: Entrance Gate / Feeder / Ranger Station / Fossil Centre / Hatchery** — preview footprint follows cursor; green if placeable, red if blocked. Click to place. Esc cancels.

Placement rules:
- Buildings cannot overlap other buildings, paths, fences, or off-map area.
- Entrance Gate must be placed on the map edge (any of the 4 edges). Max 1 instance.
- Other buildings have no placement restriction beyond non-overlap in MVP.
- Path placement allowed on any non-building, non-fenced cell.
- Fence placement allowed on any in-bounds edge that does not cross a building.

Buildings are always axis-aligned; no rotation in MVP.

---

## 6. Enclosures

An "enclosure" is a closed region bounded by fences and gates.

**Detection algorithm** (re-runs on any fence/gate change):
1. Find each placed Gate. From a cell adjacent to the gate **on the inside**, flood-fill across cells, blocked by fence edges (gates pass through).
2. If the fill is bounded (does not reach the map edge), the filled cells form an enclosure.
3. Assign the enclosure a stable ID (hash of sorted cell coords). Persist species assignment on this ID across re-detections by matching cell-set overlap > 50% with prior frame.
4. Cells that fall out of any enclosure → `enclosureId = null`.

**Species assignment**: an enclosure has no species until a hatchling is placed in it. Once placed, the enclosure adopts that species and refuses other species (hatchling placement validates). Border + fill use the species color.

**Enclosure render**: rounded-rect overlay computed as the bounding box of the cell set, inset by 4px, with border color = species color, fill = species color at 25% alpha. Species label drawn at the centroid using DOM (not Phaser text, for crispness).

In MVP, clicking inside an enclosure shows a small panel listing dinos in it. (No paleoflora toggle, no happiness — placeholder for the post-MVP exhibit menu.)

---

## 7. Buildings (MVP set)

| Building | Grid Size | Cost | Function |
|---|---|---|---|
| Entrance Gate | 2×1 | 500 [GUESS] | Visitor spawn point. Max 1. Must be on map edge. |
| Feeder | 1×1 | 100 [GUESS] | Holds up to 100 food units. Dinos in the same enclosure as the feeder eat from it. Refilled by rangers. |
| Ranger Station | 2×2 | 800 [GUESS] | Each station "houses" up to 3 rangers. Rangers spawn from here. |
| Fossil Centre | 2×2 | 1500 [GUESS] | Required to extract DNA from fossils. Extraction happens instantly in MVP (no per-fossil timer). |
| Hatchery | 3×3 | 2000 [GUESS] | Required to hatch dinos. Hatching takes 30 ticks after the player presses "Hatch". |

Each building is drawn as a colored rounded-rect with a Graphics-drawn icon (small cross / flask / egg / fence-gap / bone) [GUESS — pick simple recognizable glyphs].

Buildings expose a click target → opens the corresponding panel (Feeder shows current food + manual refill cost; Ranger Station shows roster + hire button; Fossil Centre opens DNA Panel; Hatchery opens Hatchery Panel).

---

## 8. Dinosaurs

### Species data shape
```ts
interface Species {
  id: string;
  displayName: string;
  color: string;                 // hex, used for sprite + enclosure
  portraitPath: string;          // /assets/portraits/<id>.png; stub to flat circle if missing
  spaceNeeded: number;           // min cells per individual (post-MVP happiness; stored now)
  eatAmount: number;             // food units to fill 0→100 satiation
  satiationDropRate: number;     // satiation points lost per tick (can be fractional)
  baseSpeed: number;             // px/sec on map
  wanderFreq: number;            // mean ticks between waypoint changes
  diet: 'herbivore' | 'carnivore';
  coexistsWith: string[];        // unused in MVP, persisted for later
}
```

### Initial roster (author later balance pass)

```ts
[
  {
    id: 'allosaurus', displayName: 'Allosaurus',
    color: '#C0392B', portraitPath: '/assets/portraits/allosaurus.png',
    spaceNeeded: 12, eatAmount: 40, satiationDropRate: 0.15,
    baseSpeed: 24, wanderFreq: 6, diet: 'carnivore', coexistsWith: ['utahraptor'],
  },
  {
    id: 'stegosaurus', displayName: 'Stegosaurus',
    color: '#2E86AB', portraitPath: '/assets/portraits/stegosaurus.png',
    spaceNeeded: 10, eatAmount: 50, satiationDropRate: 0.10,
    baseSpeed: 18, wanderFreq: 8, diet: 'herbivore', coexistsWith: [],
  },
  {
    id: 'utahraptor', displayName: 'Utahraptor',
    color: '#E67E22', portraitPath: '/assets/portraits/utahraptor.png',
    spaceNeeded: 6, eatAmount: 25, satiationDropRate: 0.20,
    baseSpeed: 32, wanderFreq: 4, diet: 'carnivore', coexistsWith: ['allosaurus'],
  },
]
```

### Per-dino runtime state
```ts
interface Dino {
  id: string;
  speciesId: string;
  enclosureId: string | null;     // null while held by player after hatch
  x: number; y: number;           // world px
  satiation: number;              // 0..100, starts at 100
  health: number;                 // 0..100, starts at 100
  dnaPercentAtHatch: number;      // recorded but unused in MVP
  waypoint: { x: number; y: number } | null;
  nextWanderAt: number;           // tick index
}
```

### Hunger → health → death
- Each tick: `satiation -= species.satiationDropRate`. Clamp at 0.
- While `satiation === 0`: `health -= 0.5/tick` [GUESS].
- If `health <= 0`: dino is removed, notification logged.
- Eating: when in same enclosure as a Feeder with `food > 0`, dino "eats" by walking to the feeder and consuming `min(species.eatAmount * 0.01 per tick, feeder.food)`, raising satiation accordingly. Eating triggered when `satiation < 60`.

### Rendering
- Filled circle, radius 10px, fill = species color, with portrait PNG masked into the circle (Phaser's `setMask` with a Graphics circle). If portrait fails to load → flat color circle stub.
- Smooth tween between waypoints. Wander targets: random cell inside enclosure bounds, recomputed every `wanderFreq` ± 50% ticks.

---

## 9. Visitors

```ts
interface Visitor {
  id: string;
  x: number; y: number;
  state: 'arriving' | 'viewing' | 'leaving';
  enclosuresViewed: number;
  targetCellPath: {x:number;y:number}[];
}
```

- **Spawn cadence** (replacing rating-based formula since rating is out of MVP):
  `spawnIntervalTicks = clamp( 60 / (dinoCount * priceFactor), 4, 600 )` where
  `priceFactor = max(0.1, 2 - admissionPrice/20)` [GUESS — tunable in `config.ts`].
  Result: more dinos = more visitors; lower price = more visitors but less revenue.
  No spawning if `dinoCount === 0` or no Entrance Gate.
- **Admission**: on spawn, `cash += admissionPrice`. Slider range $0–$50, default $10 [GUESS].
- **Pathing**: easystarjs A* on `walkableForVisitors`. The cells immediately outside (within 2 cells of) any enclosure are auto-marked viewable as long as a path connects to them.
- **Behavior**: from entrance, walk to a random viewable cell adjacent to an enclosure → idle 4 ticks → pick another → after viewing 3 enclosures (or if no viewable target found) → walk back to entrance → despawn.
- **Render**: small light-cream circle, radius 4px.

Visitors do not currently affect happiness/rating (those systems are out of MVP).

---

## 10. Rangers

- Hire from Ranger Station panel. Each ranger has: `id, name (random from list), wagePerDay, stationId, state, taskTarget`.
- Wage tick: `cash -= wagePerDay / 6` per tick (in-game day = 6 ticks). Default wage $30/day [GUESS].
- Tasks (priority order):
  1. Refill feeder with `food < 30%` → walks to a Fossil Centre? No — rangers refill from… let's keep it simple: rangers carry an infinite virtual food supply, walking to each low feeder and topping it to 100. The cash cost of food: `cash -= (100 - foodBefore) * 0.5` per refill [GUESS]. (Avoids needing a "food storage building" in MVP.)
  2. Idle wander near assigned station.
- Render: small dark-grey circle, radius 5px, with a colored ring matching role (single role in MVP, so just dark-grey).

---

## 11. Dig Sites & Expeditions

- 9 dig sites defined in `digSites.ts`. Each:
  ```ts
  {
    id, name, region,
    quality: 'Excellent'|'Good'|'Fair'|'Poor'|'Depleted'|'Exhausted',
    species: string[],            // species IDs whose fossils may be found here
    unlocked: boolean,
    expeditionDurationTicks: number,
    teamCost: number,             // upfront cost to dispatch
  }
  ```
- **Initial state**: 1 site unlocked, 8 locked. Each locked site has a purchase cost; unlock cost increases per unlocked site (e.g. `[2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000]` [GUESS]).
- **Site distribution across MVP species** (so each species is reachable from start-ish):
  - Each starting-region site should contain at least one common species. Spread Allosaurus/Stegosaurus/Utahraptor across multiple sites with overlap.
  - [GUESS] Sample mapping in `digSites.ts`; balance later.
- **Dispatch**: player has 1 dig team. While dispatched, the team is unavailable. Cost deducted on dispatch.
- **Haul roll** on completion:
  - Specimen count: `quality` table maps to `[2,2,1,1,0,0]` mean fossils.
  - Per fossil: pick a species uniformly from the site's list; roll DNA% from `[60-90, 40-70, 25-55, 10-35, 5-20, 0]` ranges per quality tier.
  - 10% chance per haul of one bonus valuable item (auto-sells for $500 [GUESS]).
- **Quality degradation**: 25% chance per haul to drop one tier. `Exhausted` sites can no longer be dispatched.
- **Haul Modal** (UI): for each fossil, two buttons — **Extract** (adds to DNA pool, capped at 100% per species) and **Sell** (cash bonus = `dnaPercent * $5` [GUESS]). Bonus items shown as auto-sold line items.

> **Note on the "additional sites unlock per star threshold" rule from the original overview**: superseded for MVP by the cash-purchase model above, since rating is out of MVP. Revisit when rating ships.

---

## 12. DNA & Hatchery

- DNA Manager: `Map<speciesId, number>` 0–100, persistent.
- **Fossil Market (purchase)**: out of MVP per §1. Sale price formula (`sellPrice = dnaPercent * $5`) defined now so the post-MVP buy price (`3× sell`) is consistent.
- **Hatchery Panel** lists each species with DNA ≥ 50%. Hatch button starts a 30-tick timer (one hatch at a time per Hatchery). On completion:
  - DNA stays where it is (per spec answer).
  - A "hatchling" appears in the Hatchery Panel.
  - Player clicks **Pick Up** → cursor enters "carry" mode (small floating dino sprite under cursor).
  - Player clicks inside any enclosure cell → if the enclosure has no species OR matches the hatchling's species → place. Otherwise show error toast.
  - Esc cancels carry, hatchling stays in panel.

Hatched-but-unplaced dinos persist across save/load.

---

## 13. Economy

- Starting cash: **$10,000** [GUESS].
- **Starting DNA grant**: on new game, pick one species uniformly at random from the initially-unlocked dig site's `species` list and seed `dna[speciesId] = 50`. This lets the player start hatching/placing immediately. Logged as a notification ("Starting DNA: <species> 50%").
- **Income** per event: visitor admission, fossil sale, valuable auto-sale.
- **Expenses** per tick: ranger wages.
- **Expenses** per event: building purchases, fence/path placement (free in MVP for simplicity, but cost field exists in data), expedition team cost, food refills, dig site unlocks.
- HUD shows cash with green/red flash on income/expense events.

---

## 14. Notifications & UI Layout

- **Top bar (HUD)**: cash, current time-speed (paused/1×/2×/3×), in-game day counter.
- **Left toolbar**: build modes (cursor, path, fence, gate, then 5 building icons).
- **Right side panels** (open one at a time, slide-in): Dig Sites, DNA, Hatchery, Settings (admission slider + save/load + new game).
- **Bottom-left log panel**: scrollable list of timestamped notifications. Auto-scroll to newest. Persists across session (cleared on new game).
- **Click-on-entity panels** (modal-ish, anchored): Feeder, Ranger Station, Enclosure (lists dinos).
- **Haul Modal**: blocking overlay shown on expedition return.
- **Launch Screen** before game start: New Game / Load Game (greyed if no save) / Continue (resumes auto from last session if save exists).

Notification examples (MVP):
- "Expedition to <site> returned with 2 fossils."
- "Allosaurus is starving."
- "Allosaurus has died of starvation."
- "Hatchling ready in Hatchery."
- "Visitor count: 12. Income: $120/min." (every minute summary) [GUESS]

---

## 15. Configuration Constants

All tunables centralized in `/src/data/config.ts`:

```ts
export const config = {
  grid: { cols: 80, rows: 60, cellSize: 32 },
  camera: { minZoom: 0.5, maxZoom: 2.0 },
  time: { tickMs: 1000, dayTicks: 6, speeds: [0, 1, 2, 3] },
  economy: {
    startingCash: 10_000,
    admissionDefault: 10,
    admissionMin: 0,
    admissionMax: 50,
    foodCostPerUnit: 0.5,
    rangerWagePerDay: 30,
    valuableSalePrice: 500,
    fossilSalePerDnaPercent: 5,
    digSiteUnlockCosts: [2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000],
  },
  visitors: {
    spawnBase: 60, priceFactorMin: 0.1, priceFactorSlope: 0.05,
    enclosuresPerVisit: 3, viewIdleTicks: 4,
  },
  expedition: {
    qualityToFossilCount: { Excellent: 2, Good: 2, Fair: 1, Poor: 1, Depleted: 0, Exhausted: 0 },
    qualityToDnaRange: {
      Excellent: [60, 90], Good: [40, 70], Fair: [25, 55],
      Poor: [10, 35], Depleted: [5, 20], Exhausted: [0, 0],
    },
    degradeChance: 0.25,
    valuableChance: 0.10,
    dnaCap: 100, hatchThreshold: 50, hatchTicks: 30,
  },
  dinos: { starvationHealthDrop: 0.5, eatTriggerSatiation: 60 },
} as const;
```

---

## 16. Save / Load

- Single localStorage key `dpb.save.v1`. JSON shape:
  ```ts
  {
    version: 1,
    rngSeed: number,
    tick: number,
    cash: number,
    admissionPrice: number,
    fenceEdges: string[],
    paths: string[],          // "x,y"
    buildings: Building[],
    enclosures: { id, cells, speciesId }[],
    dinos: Dino[],
    rangers: Ranger[],
    visitors: Visitor[],      // optional; can be empty (respawn fresh)
    digSites: DigSite[],
    activeExpedition: { siteId, finishesAtTick } | null,
    pendingHaul: HaulModalState | null,
    dna: Record<speciesId, number>,
    pendingHatchlings: { id, speciesId }[],
    hatchInProgress: { speciesId, finishesAtTick } | null,
    notificationLog: { tick, msg }[],
    timeSpeed: 0|1|2|3,
  }
  ```
- Save: button in Settings panel + Ctrl+S shortcut.
- Load: launch screen + Settings panel button. Loading mid-game prompts a confirm.
- Schema version field for forward compatibility; no migration code in MVP — loading a mismatched version shows an error.

---

## 17. EventBus Contract

UI ↔ sim communication is via the `EventBus` defined in the overview. All event names use kebab-case and live in `/src/EventBus.ts` as exported constants.

Key events (non-exhaustive):
- `build-mode-changed` (mode)
- `building-placed` (building)
- `fence-toggled` (edgeKey)
- `path-toggled` (cellKey)
- `enclosure-detected` (enclosure)
- `dino-clicked` (dinoId)
- `enclosure-clicked` (enclosureId)
- `expedition-dispatched` (siteId)
- `expedition-returned` (haul)
- `fossil-extracted` / `fossil-sold`
- `hatch-started` / `hatch-ready` / `hatch-placed`
- `ranger-hired`
- `cash-changed` (cash, delta)
- `notification` (msg)
- `time-speed-changed` (speed)
- `save-requested` / `load-requested`

---

## 18. Tick Loop

```
Phaser update(time, dt):
  accumulator += dt * timeSpeedMultiplier
  while accumulator >= tickMs:
    sim.tick(tickIndex++)
    accumulator -= tickMs
  renderers.sync(sim, interpolation = accumulator / tickMs)
```

Single `sim.tick(t)` calls in fixed order: economy → digSites → hatchery → dinos → rangers → visitors → notifications.

---

## 19. Open Questions Worth Revisiting

- Path/fence pricing — currently free in MVP, but feels like it should cost something modest.
- Should rangers consume time refilling (walk to feeder + N-tick refill animation), or is instant-on-arrival fine? Spec says instant-on-arrival.
- Visitor view "satisfaction" is a no-op in MVP (no rating to feed). Confirm we just want them walking around for vibe.
- Hatchery occupancy: only 1 hatch at a time per Hatchery, but multiple Hatcheries allowed?
- Carry-mode UX: drop on invalid → toast or silent return? Spec says toast.
- Notification log size cap (e.g. last 200) before truncation.

---

## 20. Suggested Build Order

0. **New-game initialization**: starting cash + starting DNA grant (random species from initial dig site at 50%) wired before any other system depends on DNA state.
1. **Foundation**: project scaffold (Vite + TS + Phaser), `EventBus`, `config.ts`, BootScene → ParkScene with green background and grid.
2. **World grid + camera**: pan/zoom, cell coordinate conversion, grid renderer.
3. **Build modes scaffold**: toolbar UI, mode switching, cursor preview overlay.
4. **Paths + fences**: click-drag placement & erase, persistence in `World`.
5. **Buildings**: placement preview/validation, all 5 types as colored rects with placeholder icons.
6. **Enclosure detection**: gate placement, flood-fill, render.
7. **Dig sites + expedition + Haul Modal**: timer, dispatch, return roll. No DNA yet — just sell prices into cash.
8. **DNA Panel + Fossil Centre extract flow**.
9. **Hatchery + carry-mode placement**.
10. **Dino entities**: render, wander, hunger, death.
11. **Feeders + rangers**: hire UI, refill task loop.
12. **Visitors**: A* pathing, spawn loop, admission income.
13. **Economy HUD + admission slider**.
14. **Notification log**.
15. **Save/load + launch screen**.
16. **Polish pass**: zoom limits, edge cases (hatching with no enclosure, all sites exhausted, etc.), notification copy.

Each step should leave the game runnable.
