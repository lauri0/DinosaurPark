import Phaser from 'phaser';
import { BootScene } from './game/BootScene';
import { ParkScene } from './game/ParkScene';
import { World } from './sim/World';
import { loadWorld, saveWorld } from './sim/Save';
import { showLaunchScreen } from './ui/LaunchScreen';
import { mountBuildPalette } from './ui/BuildPalette';
import { mountHUD } from './ui/HUD';
import { mountDigSitesPanel } from './ui/DigSitesPanel';
import { mountHaulModal } from './ui/HaulModal';
import { mountDNAPanel } from './ui/DNAPanel';
import { mountHatcheryPanel } from './ui/HatcheryPanel';
import { mountRangerPanel } from './ui/RangerPanel';
import { mountFeederPanel } from './ui/FeederPanel';
import { mountFacilityPanel } from './ui/FacilityPanel';
import { mountExhibitPanel } from './ui/ExhibitPanel';
import { mountNotificationLog } from './ui/NotificationLog';
import { mountSettingsPanel } from './ui/SettingsPanel';
import { mountParkPanel } from './ui/ParkPanel';
import { mountDinoPanel } from './ui/DinoPanel';
import { mountVisitorPanel } from './ui/VisitorPanel';
import { initToasts } from './ui/toast';
import { emit, on, Events } from './EventBus';
import { DIG_SITES } from './data/digSites';
import { recomputeEnclosures } from './sim/Enclosures';

let game: Phaser.Game | null = null;
let currentWorld: World | null = null;
const getWorld = () => {
  if (!currentWorld) throw new Error('World not initialized');
  return currentWorld;
};

async function main(): Promise<void> {
  // Show launch screen first, before any world-dependent UI is mounted.
  const choice = await showLaunchScreen();

  // Resolve which world to use.
  let world: World;
  if (choice.kind === 'load') {
    world = loadWorld() ?? initNewWorld();
  } else {
    world = initNewWorld();
  }
  currentWorld = world;

  // Mount all UI now that currentWorld exists.
  initToasts();
  mountBuildPalette();
  mountHUD(getWorld);
  mountDigSitesPanel(getWorld);
  mountHaulModal(getWorld);
  mountDNAPanel(getWorld);
  mountHatcheryPanel(getWorld);
  mountRangerPanel(getWorld);
  mountFeederPanel(getWorld);
  mountFacilityPanel(getWorld);
  mountExhibitPanel(getWorld);
  mountNotificationLog(getWorld);
  mountSettingsPanel(getWorld);
  mountParkPanel(getWorld);
  mountDinoPanel(getWorld);
  mountVisitorPanel(getWorld);

  on(Events.SaveRequested, () => {
    if (currentWorld) saveWorld(currentWorld);
  });
  on(Events.LoadRequested, () => {
    const w = loadWorld();
    if (w) startGameWith(w);
  });
  on(Events.NewGameRequested, () => {
    startGameWith(initNewWorld());
  });

  startGameWith(world);
}

function initNewWorld(): World {
  const w = new World(Math.floor(Math.random() * 1e9));
  const initialSite = DIG_SITES[0]!;
  const seedSpecies = w.rng.pick(initialSite.species);
  w.dna[seedSpecies] = 50;
  w.log(`Starting DNA: ${seedSpecies} 50%`);
  w.log(`Welcome to Dinosaur Park. Cash: $${w.cash.toLocaleString()}.`);
  recomputeEnclosures(w);
  return w;
}

function startGameWith(world: World): void {
  currentWorld = world;
  if (game) {
    game.scene.stop('ParkScene');
    game.scene.start('ParkScene', { world });
  } else {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-root',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#000000',
      scene: [BootScene, ParkScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
    });
    game.events.once(Phaser.Core.Events.READY, () => {
      game!.scene.start('ParkScene', { world });
    });
    window.addEventListener('resize', () => {
      if (game) game.scale.resize(window.innerWidth, window.innerHeight);
    });
  }
  emit(Events.StateReset, null);
  emit(Events.CashChanged, { cash: world.cash, delta: 0, reason: 'init' });
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#fff;padding:20px">${String(err)}</pre>`;
});
