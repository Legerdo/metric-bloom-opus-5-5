import './ui/fonts.css';
import './ui/styles.css';
import { Game } from './game';
import { UI } from './ui/ui';
import { audio } from './audio/audio';

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const debug = params.has('debug');
  // Wait for the pixel font so the canvas overlay text measures correctly.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('12px Galmuri11'), document.fonts.load('bold 12px Galmuri11'), document.fonts.load('15px Galmuri14')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    // fonts are optional
  }
  const canvas = document.createElement('canvas');
  const game = new Game(canvas, debug);
  const root = document.getElementById('root')!;
  root.textContent = '';
  const ui = new UI(game, root);

  // Browsers only allow audio after a user gesture.
  const unlock = (): void => {
    audio.unlock();
    audio.setVolumes(game.settings.music, game.settings.sfx);
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.save();
      audio.suspend();
    } else {
      audio.resume();
    }
  });
  window.addEventListener('pagehide', () => game.save());
  window.addEventListener('beforeunload', () => game.save());

  if (game.pendingOffline) ui.showOffline(game.pendingOffline);
  ui.resumeEndingIfNeeded();

  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      game.frame(now);
      ui.frame(dt);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  if (debug) {
    const { mountDebug } = await import('./ui/debug');
    mountDebug(game, ui);
    (window as unknown as { __mb: unknown }).__mb = { game, ui };
  }
}

void boot();
