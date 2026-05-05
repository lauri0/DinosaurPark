# Dinosaur Park Builder — Project Overview

## Concept
A 2D top-down dinosaur park management game running in the browser. The player builds and manages a dinosaur theme park: constructing enclosures, funding fossil expeditions, extracting DNA, hatching dinosaurs, hiring staff, and keeping visitors happy and safe. The aesthetic is clean and minimalist — inspired by Mini Metro — with all map graphics drawn as vector shapes via code, and generated 2D dinosaur portrait images used only in UI panels and as masked circle sprites on the map.

---

## Tech Stack

| Purpose | Tool |
|---|---|
| Game engine | Phaser 3 |
| Language | TypeScript |
| Build tool | Vite |
| Pathfinding | easystarjs |
| UI layer | Vanilla HTML + CSS (overlaid on canvas) |
| Persistence | localStorage (JSON serialization) |

No backend. No tile maps. No sprite sheets for terrain or buildings.

---

## Visual Style

Everything rendered on the map uses **Phaser's Graphics API** (programmatic vector drawing only). No terrain tile sets or building sprites.
Mouse pointer drag and scroll wheel zoom are supported in the main world view.

### Map Elements
- **Terrain** — flat colored polygon regions (muted green for land, soft blue for water, beige for paths/roads)
- **Grid** — subtle grid lines drawn over terrain, snap-to-grid for all placement
- **Enclosures** — rounded rectangles with a species-specific border color and a lighter fill of the same hue. Each dinosaur species has an assigned color. A label shows the species name.
- **Fences** — thin line segments along grid edges with small dot posts at corners
- **Paths** — thick rounded lines connecting buildings to the park entrance (walkable routes for visitors)
- **Buildings** — colored rectangles occupying one or more grid cells. Shape/color combination communicates function. A simple icon drawn with the Graphics API differentiates types (e.g. small cross on vet building, flask shape on research lab). No sprites.
- **Dinosaurs** — filled circle (species color) with the dinosaur's generated 2D portrait image masked into it. Moves smoothly between waypoints inside its enclosure.
- **Visitors** — small light-colored circles, move along paths using A*
- **Staff** — small darker circles with a color coding their role (keeper, vet, worker), move to assigned tasks

### UI Panels (HTML/CSS overlaid on canvas)
- Panels slide in from the side or appear as modals
- Can display full-resolution generated dinosaur portrait images
- All menus, toolbars, stat bars, and overlays are DOM elements, not drawn in Phaser

---

## Core Systems Detail

### Grid & Enclosure System
- World state is a 2D array of cells. Each cell stores: terrain type, building ID or null, fence edges (N/S/E/W flags), walkability.
- Fences are placed on cell edges (not cell centers). Stored as a Set of edge descriptors.
- Enclosure validation: flood-fill from a placed gate. If the fill is bounded, the enclosure is valid and gets an ID.
- Each valid enclosure is assigned to a species and gets that species' color applied to its fill and border.
- Dinosaurs are associated with an enclosure ID. Their wander waypoints are constrained to cells within that enclosure.

### Entity Movement
- All movement uses **Phaser tweens** along waypoint arrays — no physics engine.
- **Visitors**: A* via easystarjs on the walkable grid layer. Walk from entrance along paths to viewing areas, then back.
- **Staff**: Walk to their assigned task cell (nearest hungry dino, sick dino, broken building). Idle wander near their assigned zone otherwise.
- **Dinosaurs**: Random waypoint selection within enclosure bounds. Speed and wander frequency driven by species stats.

### Park rating
- The park has a star rating (0-5 stars) which is based on the park's dinosaur roster minus any potential dinosaur and guest satisfaction issues.
- Every species of dinosaur shown in the park can contribute up to 0.5 stars to the park's rating.
- Dinosaur species themselves have appeal star ratings - e.g. 3.5 stars.
- Each dinosaur species' rating can only contribute to the park rating up to the dinosaur's own appeal - if the player has three 1-star dinosaur species then the first two will
bump up the park rating up by 0.5 each, but the third one will not increase the park rating beyond 1 since it is only a 1-star dinosaur.

### Expedition & DNA System
- **9 dig sites** defined in data, each with: name, region, initial quality (Excellent/Good/Fair/Poor/Depleted/Exhausted), and a list of dinosaur species whose fossils can be found there.
- Initially the player chooses one dig site to unlock. Later on, an additional site can be unlocked at every park rating threshold (at 1, 2, 3, 4 and 5 stars).
- Site quality has a chance to degrade each time an expedition completes there.
- Player assigns a dig team to a site. After a time duration (scaled by site quality), the expedition returns with a **haul**: 0-2 fossil specimens, each with a DNA % yield determined by site quality + RNG. Occasional bonus valuables (sold automatically for cash).
- **DNA Manager** accumulates fossil DNA per species. Multiple fossils of the same species stack up to 100%.
- When fossils are found, the player can choose whether to extract DNA from them or sell them (can choose individually per fossil).
- Minimum **50% DNA** required to hatch. Higher % = longer natural lifespan.
- Player hatches from the DNA Panel when threshold is met. A dinosaur entity spawns in an assigned enclosure.

### Fossil Market
- The fossil market allows the player to buy fossils of any species which is available to the player via 

### Research Tree
- JSON-defined directed acyclic graph of nodes.
- Node types: unlock new building types, unlock staff upgrades, unlock enclosure upgrades.
- Rendered as an HTML/CSS overlay with SVG connector lines between nodes.
- Research costs money and takes time (tick-based). Only one item can be researched at a time.

### Economy
- Income is based on visitor admissions, shop purchases, donations and expedition haul sales.
- Expenses include staff wages, dinosaur food refills (depends on food amount and type), building maintenance, taxes (depend on highest park rating so far - does not reduce if park rating goes down).
- Valuables from expeditions are sold manually on haul return for a cash bonus.

### Needs System & Events
- Each dinosaur has: hunger (depletes over time, refilled by feeders), health (drops from illness, hunger or injury), happiness (affected by enclosure size, social needs, correct paleoflora in exhibit).
- If hunger hits zero → health begins dropping → dinosaur death.
- If security fails (fence breach, no ranger nearby) → **escape event**: visitors flee, park rating drops for a year. After fixing the fence, the park can be reopened.
- Events are surfaced as notifications and map alerts. Player must assign staff or spend money to resolve.

---

## Building Types (Examples)

| Building | Grid Size | Function |
|---|---|---|
| Entrance Gate | 2×1 | Park entry point, visitor spawn |
| Viewing Gallery | 2×2 | Visitors gain happiness near enclosures |
| Feeder | 1×1 | Reduces dinosaur hunger in enclosure |
| Ranger Station | 2×2 | Rangers patrol nearby, prevent/resolve escapes |
| Vet Clinic | 2×2 | Vets heal sick dinosaurs |
| Research Lab | 3×2 | Required to conduct research |
| Fossil Centre | 2×2 | Required to extract DNA from fossils |
| Hatchery | 3×3 | Required to hatch dinosaurs |
| Gift Shop | 1×2 | Passive income boost |
| Restroom | 1×1 | Visitor happiness boost |
| Power Generator | 1×1 | Powers surrounding buildings |

---

## UI / UX Flow

1. **Start**: Small budget, one enclosure, research lab and hatchery placeable. One dig team available.
2. **Assign expedition** → wait for return → receive fossils → extract DNA in Fossil Centre → accumulate to 50%+ → hatch in Hatchery → dinosaur appears in assigned enclosure.
3. **Visitors** begin arriving via entrance. They walk paths to view enclosures. Income ticks.
4. **Hire staff** (rangers, vets, workers) as park grows. Assign to zones.
5. **Research** unlocks new species, buildings, upgrades. Loop continues.

---

## EventBus Pattern (Phaser ↔ HTML UI)

```typescript
// EventBus.ts
export const EventBus = new EventTarget();
export const emit = (name: string, detail?: unknown) =>
  EventBus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name: string, cb: (e: CustomEvent) => void) =>
  EventBus.addEventListener(name, cb as EventListener);

// In ParkScene.ts (Phaser)
dino.on('pointerdown', () => emit('dino-selected', dino.data.getAll()));

// In DinoPanel.ts (HTML)
on('dino-selected', (e) => {
  panel.classList.add('open');
  populatePanel(e.detail);
});
```

All Phaser → UI communication goes through EventBus. UI → Phaser commands (e.g. enter build mode) also go through EventBus.

---

## Save / Load

Serialize to localStorage as a single JSON object:
- World grid array
- Building placements and states
- Enclosure definitions and assigned species
- All entity states (position, needs values)
- Dig site quality levels, team assignments, expedition timers
- DNA percentages per species
- Research progress and unlocked nodes
- Economy state (money, rating)

---

## Suggested Build Order (TBD)
