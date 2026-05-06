export const EventBus = new EventTarget();

export const emit = (name: string, detail?: unknown): void => {
  EventBus.dispatchEvent(new CustomEvent(name, { detail }));
};

export const on = <T = unknown>(
  name: string,
  cb: (detail: T) => void,
): (() => void) => {
  const handler = (e: Event) => cb((e as CustomEvent<T>).detail);
  EventBus.addEventListener(name, handler);
  return () => EventBus.removeEventListener(name, handler);
};

export const Events = {
  BuildModeChanged: 'build-mode-changed',
  BuildingPlaced: 'building-placed',
  BuildingRemoved: 'building-removed',
  FenceToggled: 'fence-toggled',
  PathToggled: 'path-toggled',
  EnclosuresUpdated: 'enclosures-updated',
  EnclosureClicked: 'enclosure-clicked',
  DinoClicked: 'dino-clicked',
  VisitorClicked: 'visitor-clicked',
  ExpeditionDispatched: 'expedition-dispatched',
  ExpeditionReturned: 'expedition-returned',
  FossilExtracted: 'fossil-extracted',
  FossilSold: 'fossil-sold',
  HatchStarted: 'hatch-started',
  HatchReady: 'hatch-ready',
  HatchPlaced: 'hatch-placed',
  HatchPickedUp: 'hatch-picked-up',
  RangerHired: 'ranger-hired',
  CashChanged: 'cash-changed',
  Notification: 'notification',
  TimeSpeedChanged: 'time-speed-changed',
  SaveRequested: 'save-requested',
  LoadRequested: 'load-requested',
  NewGameRequested: 'new-game-requested',
  AdmissionPriceChanged: 'admission-price-changed',
  DigSiteUnlockRequested: 'dig-site-unlock-requested',
  HireRangerRequested: 'hire-ranger-requested',
  FeederClicked: 'feeder-clicked',
  RangerStationClicked: 'ranger-station-clicked',
  FossilCentreClicked: 'fossil-centre-clicked',
  HatcheryClicked: 'hatchery-clicked',
  EntranceGateClicked: 'entrance-gate-clicked',
  ToastError: 'toast-error',
  TickAdvanced: 'tick-advanced',
  StateReset: 'state-reset',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
