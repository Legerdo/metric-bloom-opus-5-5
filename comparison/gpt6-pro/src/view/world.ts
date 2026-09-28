import Phaser from 'phaser';
import type { GameState } from '../game/types';
import { production, format } from '../game/economy';
import { drawWorld } from './world-art';
import { peopleAtlas } from './sprites';
import { Pixel, PAL as C } from './pixel';

type Actor = { sprite: Phaser.GameObjects.Sprite; x: number; y: number; width: number; phase: number; stage: number };
type Speck = { sprite: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; life: number };
export class GardenScene extends Phaser.Scene {
  private phase = -1;
  private ended = false;
  private actors: Actor[] = [];
  private specks: Speck[] = [];
  private notes: Phaser.GameObjects.Image[] = [];
  private birds: Phaser.GameObjects.Sprite[] = [];
  private popup: Phaser.GameObjects.Text | null = null;
  private popupTime = 0;
  private visualTime = 0;
  constructor(private state: () => GameState, private interact: (target: string) => void) { super('Garden'); }
  create(): void {
    this.textures.addCanvas('world', drawWorld(this.state().chapter, this.state().ended));
    this.add.image(0, 0, 'world').setOrigin(0);
    [C.coral, C.blue, C.leaf, C.lavender].forEach((color, i) => {
      const texture = this.textures.addCanvas(`person${i}`, peopleAtlas(color))!;
      for (let f = 0; f < 6; f++) texture.add(String(f), 0, f * 16, 0, 16, 24);
    });
    const locations = [[290, 222, 0, 0], [324, 238, 33, 0], [91, 263, 35, 1], [138, 267, 12, 1], [532, 279, 27, 2], [493, 279, 8, 2], [183, 170, 22, 3], [455, 178, 39, 5], [353, 255, 20, 7], [42, 152, 24, 8]];
    this.actors = locations.map(([x, y, width, stage], i) => ({ sprite: this.add.sprite(x, y, `person${i % 4}`, '0').setOrigin(0.5, 1), x, y, width, stage, phase: i * 2.73 }));
    const note = new Pixel(9, 7); note.r(0, 0, 9, 6, C.darkwood); note.r(1, 1, 7, 4, C.cream); note.r(2, 2, 5, 1, C.coral); note.r(2, 4, 3, 1, C.gold); note.r(1, 6, 2, 1, C.cream);
    this.textures.addCanvas('note', note.canvas);
    const petal = new Pixel(5, 5); petal.r(1, 0, 3, 5, C.coral); petal.r(0, 1, 5, 3, C.coral); petal.r(2, 2, 1, 1, C.gold); this.textures.addCanvas('petal', petal.canvas);
    const bird = new Pixel(36, 8);
    for (let f = 0; f < 3; f++) { const x = f * 12; bird.r(x + 5, 3, 3, 2, C.cream); bird.r(x + 8, 3, 2, 1, C.gold); bird.line(x + 5, 3, x + 2, f === 0 ? 0 : f === 1 ? 3 : 6, C.cream); bird.line(x + 7, 3, x + 9, f === 0 ? 0 : f === 1 ? 3 : 6, C.paper); }
    const bt = this.textures.addCanvas('birds', bird.canvas)!; for (let f = 0; f < 3; f++) bt.add(String(f), 0, f * 12, 0, 12, 8);
    this.birds = [0, 1, 2].map(i => this.add.sprite(40 + i * 150, 50 + i * 13, 'birds', '0'));
    this.notes = Array.from({ length: 12 }, () => this.add.image(0, 0, 'note').setVisible(false));
    this.specks = Array.from({ length: 48 }, () => ({ sprite: this.add.image(0, 0, 'petal').setVisible(false), x: 0, y: 0, vx: 0, vy: 0, life: 0 }));
    this.popup = this.add.text(310, 176, '', { fontFamily: 'monospace', fontSize: '11px', color: C.paper, stroke: C.ink, strokeThickness: 3 }).setOrigin(0.5).setDepth(20);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > 155 && p.y < 255 && p.x > 260 && p.x < 355) this.interact('post');
      else if (p.x < 200 && p.y > 180) this.interact('studio');
      else if (p.x > 470 && p.y > 210) this.interact('salon');
      else if (p.x < 240 && p.y > 95 && p.y < 190) this.interact('archive');
      else if (p.x > 410 && p.y < 210) this.interact('relay');
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { this.game.canvas.style.cursor = p.x > 260 && p.x < 355 && p.y > 155 && p.y < 255 ? 'pointer' : 'default'; });
  }
  burst(kind: string, text = ''): void {
    if (!this.popup) return;
    this.popup.setText(text); this.popupTime = 1.5;
    const count = kind === 'post' ? 6 : kind === 'purchase' ? 10 : 36;
    for (let i = 0; i < count; i++) {
      const s = this.specks[i]; s.x = kind === 'post' ? 295 : 320; s.y = kind === 'post' ? 199 : 210;
      const a = i / count * Math.PI * 2; s.vx = Math.cos(a) * (15 + i % 5 * 10); s.vy = Math.sin(a) * 30 - 25; s.life = 1.1 + i % 4 * 0.3;
    }
  }
  update(_time: number, delta: number): void {
    const s = this.state(), dt = Math.min(delta, 100) / 1000, reduced = s.settings.reducedMotion;
    if (s.chapter !== this.phase || s.ended !== this.ended) {
      const texture = this.textures.get('world') as Phaser.Textures.CanvasTexture;
      texture.context.clearRect(0, 0, 640, 360); texture.context.drawImage(drawWorld(s.chapter, s.ended), 0, 0); texture.refresh();
      this.phase = s.chapter; this.ended = s.ended;
    }
    this.visualTime += dt; const t = this.visualTime;
    this.actors.forEach((a, i) => {
      a.sprite.setVisible(s.chapter >= a.stage);
      const u = t * 0.18 + a.phase, move = !reduced && a.width > 0 && Math.abs(Math.cos(u)) > .12;
      a.sprite.x = Math.round(a.x + (!reduced ? Math.sin(u) * a.width * 0.5 : 0));
      a.sprite.setFlipX(move && Math.cos(u) < 0);
      a.sprite.setFrame(String(reduced ? 0 : move ? Math.floor(t * 5 + i) % 4 : 4 + Math.floor(t * 2 + i) % 2));
      a.sprite.setDepth(a.y / 100);
    });
    this.birds.forEach((b, i) => { b.setFrame(String(reduced ? 1 : Math.floor(t * 6 + i) % 3)); b.x = reduced ? 50 + i * 150 : (t * (9 + i * 2) + i * 171) % 700 - 30; });
    const n = s.generators.desk ? Math.min(12, 1 + Math.floor(Math.log10(1 + production(s).attention))) : 0;
    this.notes.forEach((note, i) => {
      note.setVisible(i < n && !reduced);
      const u = (t * (0.09 + i * 0.003) + i / 12) % 1;
      const target = s.chapter >= 5 ? [[104, 235], [538, 247], [179, 140], [512, 153]][i % 4] : [[318, 110], [360, 111]][i % 2];
      note.setPosition(Math.round(299 + (target[0] - 299) * u), Math.round(195 + (target[1] - 195) * u - Math.sin(u * Math.PI) * 35)).setAlpha(Math.sin(u * Math.PI)).setDepth(8);
    });
    this.specks.forEach(p => { p.life -= dt; p.sprite.setVisible(p.life > 0 && !reduced); if (p.life > 0) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 20 * dt; p.sprite.setPosition(Math.round(p.x), Math.round(p.y)).setAlpha(Math.min(1, p.life)).setDepth(12); } });
    this.popupTime -= dt;
    if (this.popup) this.popup.setVisible(this.popupTime > 0).setPosition(304, 171 - (1.5 - this.popupTime) * 16).setAlpha(Math.min(1, this.popupTime));
    if (s.ended && !reduced && Math.floor(t * 2) !== Math.floor((t - dt) * 2)) { const p = this.specks[Math.floor(t * 2) % 48]; p.x = 100 + (t * 117 % 440); p.y = 30; p.vx = Math.sin(t) * 8; p.vy = 10; p.life = 4; }
  }
}
export function createWorld(parent: string, state: () => GameState, action: (target: string) => void): { game: Phaser.Game; scene: GardenScene } {
  const scene = new GardenScene(state, action);
  const game = new Phaser.Game({ type: Phaser.AUTO, parent, width: 640, height: 360, pixelArt: true, backgroundColor: C.ink, banner: false, audio: { noAudio: true }, fps: { target: 30, limit: 30 }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [scene] });
  return { game, scene };
}
