// Browser verification: drives the built game in Chrome/Edge via playwright-core,
// captures screenshots of key states and collects console errors.
// Usage: npm run preview (in another terminal), then: node scripts/screenshots.mjs [baseUrl]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:4173/';
const OUT = path.resolve('shots');
fs.mkdirSync(OUT, { recursive: true });

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const exe = candidates.find((p) => fs.existsSync(p));
if (!exe) throw new Error('No Chrome/Edge found');

const errors = [];
const log = (...a) => console.log(...a);

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  log('shot', name);
};
const state = () =>
  page.evaluate(() => {
    const g = window.__mb.game;
    const r = g.s.run;
    return {
      hearts: r.hearts,
      followers: r.followers,
      bond: r.bond,
      lines: r.lines,
      ups: Object.keys(r.ups),
      runs: g.s.meta.runs,
      net: r.net,
      festival: r.festival,
      gauge: r.festivalGauge,
      ended: g.s.meta.ended,
      comments: r.comments.length,
      time: g.s.meta.totalTime,
      tabs: [...document.querySelectorAll('.tab')].filter((t) => t.style.display !== 'none').map((t) => t.textContent),
      goal: document.querySelector('#goal .gt')?.textContent,
    };
  });
const debugBtn = async (label) => {
  await page.locator('#debug button', { hasText: label }).first().click();
};
const waitReady = async () => {
  await page.waitForFunction(() => !!window.__mb && document.querySelector('#hud') !== null, null, { timeout: 15000 });
  await page.waitForTimeout(600);
};

// 1. fresh start
await page.goto(BASE + '?debug=1');
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '?debug=1');
await waitReady();
await page.evaluate(() => (document.getElementById('debug').style.display = 'none'));
await shot('01_start');

// 2. first verb via the canvas (real pointer input)
const canvas = page.locator('#stage canvas');
const box = await canvas.boundingBox();
for (let i = 0; i < 12; i++) {
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.75);
  await page.waitForTimeout(140);
}
log('after posts', await state());
await shot('02_first_posts');

// 3. first purchase through the real UI
await page.locator('.tab', { hasText: '작업실' }).click();
await page.locator('#tabbody .btn', { hasText: '' }).first().click();
await page.waitForTimeout(200);
for (let i = 0; i < 10; i++) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(130);
}
await page.locator('.tab', { hasText: '루틴' }).click();
await page.locator('#tabbody .btn', { hasText: '+1' }).first().click();
await page.waitForTimeout(300);
const s3 = await state();
log('after first buys', s3);
if (!s3.ups.includes('window') || s3.lines.text < 1) errors.push('[check] first purchases failed through UI');
// let it idle a bit at 20x
await page.evaluate(() => (window.__mb.game.speed = 20));
await page.waitForTimeout(4000);
await page.evaluate(() => (window.__mb.game.speed = 1));
await page.waitForTimeout(600);
const s4 = await state();
log('after short idle', s4);
if (!(s4.hearts > s3.hearts || s4.lines.text > s3.lines.text)) errors.push('[check] routines did not produce');
await shot('03_early_routines');

// reply to a comment by clicking its bubble
const replied = await page.evaluate(() => {
  const g = window.__mb.game;
  return g.s.run.comments.length;
});
log('comments visible', replied);

// 4. debug jumps through the phases
const phases = [
  ['크루 직전', '04_before_crew'],
  ['독립 직전', '05_before_independence'],
  ['독립 직후', '06_after_independence'],
  ['블룸 개화', '07_network_open'],
  ['꽃잎 3', '08_three_petals'],
  ['대개화', '09_festival'],
];
for (const [label, name] of phases) {
  await page.evaluate(() => (document.getElementById('debug').style.display = ''));
  await debugBtn(label);
  await page.waitForLoadState('load');
  await waitReady();
  await page.evaluate(() => (document.getElementById('debug').style.display = 'none'));
  await page.waitForTimeout(label === '블룸 개화' ? 4500 : 1500);
  log(label, await state());
  await shot(name);

  if (label === '크루 직전') {
    // reply by clicking a real comment bubble on the canvas
    const before = await page.evaluate(() => window.__mb.game.s.meta.manualReplies);
    const b = await page.evaluate(() => window.__mb.game.view.bubbles[0] ?? null);
    if (b) {
      const cb = await canvas.boundingBox();
      await page.mouse.click(cb.x + b.x + b.w / 2, cb.y + b.y + b.h / 3);
      await page.waitForTimeout(200);
      const after = await page.evaluate(() => window.__mb.game.s.meta.manualReplies);
      log('bubble reply', before, '->', after);
      if (after <= before) errors.push('[check] clicking a comment bubble did not reply');
    } else errors.push('[check] no comment bubble to click');
  }
  if (label === '독립 직전') {
    // real prestige flow through the UI
    await page.locator('.tab', { hasText: '독립' }).click();
    await page.waitForTimeout(200);
    await page.locator('#tabbody .btn', { hasText: '독립하기' }).click();
    await page.waitForTimeout(200);
    await shot('05b_prestige_confirm');
    await page.locator('#modal .btn', { hasText: '떠나기' }).click();
    await page.waitForTimeout(2500);
    const st = await state();
    log('after UI prestige', st.runs, st.followers);
    if (st.runs !== 1) errors.push('[check] prestige through UI failed');
    await shot('05c_after_prestige_ui');
  }
}

// feed tab screenshot
await page.locator('.tab', { hasText: '피드' }).click();
await page.waitForTimeout(400);
await shot('10_feed_tab');

// 5. save / reload integrity
const before = await state();
await page.evaluate(() => window.__mb.game.save());
await page.reload();
await waitReady();
const after = await state();
log('reload', { before: before.followers, after: after.followers });
if (Math.abs(after.followers - before.followers) / Math.max(1, before.followers) > 0.2 || after.runs !== before.runs || after.net !== before.net)
  errors.push('[check] save/reload mismatch');

// 6. ending: jump close, then run at speed until the ending triggers
await debugBtn('엔딩 직전');
await page.waitForLoadState('load');
await waitReady();
await page.evaluate(() => (window.__mb.game.speed = 20));
await page.waitForFunction(() => window.__mb.game.s.meta.ended, null, { timeout: 60000 }).catch(() => errors.push('[check] ending not reached'));
await page.evaluate(() => (window.__mb.game.speed = 1));
await page.evaluate(() => (document.getElementById('debug').style.display = 'none'));
await page.waitForTimeout(6000);
await shot('11_ending_bloom');
await page.waitForTimeout(16000);
await shot('12_ending_text');
await page.evaluate(() => {
  const sc = document.querySelector('#ending .scroll');
  sc.scrollTop = sc.scrollHeight;
});
await page.waitForTimeout(8000);
await shot('13_ending_credits');

// 7. small laptop viewport and mobile-ish layout
await page.setViewportSize({ width: 1024, height: 640 });
await page.locator('#ending .btn', { hasText: '계속' }).click().catch(() => {});
await page.waitForTimeout(800);
await shot('14_small_laptop');
await page.setViewportSize({ width: 420, height: 860 });
await page.waitForTimeout(800);
await shot('15_narrow');

await browser.close();
fs.writeFileSync(path.join(OUT, 'errors.txt'), errors.join('\n') || 'NO ERRORS');
log('errors:', errors.length ? errors : 'none');
