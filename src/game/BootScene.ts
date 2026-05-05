import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }
  create() {
    // ParkScene is launched explicitly by main with the chosen World.
  }
}
