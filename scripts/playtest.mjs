// Real-time playtest (no debug speedups): a simple greedy player uses only the
// visible UI — the post button, comment bubbles, tabs and enabled buy buttons —
// for a few minutes at normal speed, then checks save/reload and offline return.
// Usage: npm run preview (other terminal), then node scripts/playtest.mjs [minutes]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const MIN = Number(process.argv[2] || 4);
const BASE = 'http://localhost:4173/';
const OUT = path.resolve('shots');
fs.mkdirSync(OUT, { recursive: true });
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const errors = [];
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
await page.waitForSelector('#postbtn');
await page.waitForTimeout(500);

const read = () =>
  page.evaluate(() => {
    const txt = (sel) => document.querySelector(sel)?.textContent ?? '';
    const res = [...document.querySelectorAll('#hud .res')].filter((e) => e.style.display !== 'none').map((e) => e.textContent);
    return { res, goal: txt('#goal .gt'), tabs: [...document.querySelectorAll('.tab')].filter((t) => t.style.display !== 'none').map((t) => t.textContent) };
  });

const t0 = Date.now();
let lastLog = 0;
let buys = 0;
let tabIdx = 0;
const canvas = page.locator('#stage canvas');
while (Date.now() - t0 < MIN * 60000) {
  // post a few times (≈4 clicks/s)
  for (let i = 0; i < 4; i++) {
    await page.locator('#postbtn').click();
    await page.waitForTimeout(230);
  }
  // reply to the oldest comment with the keyboard shortcut (same as clicking its bubble)
  await canvas.focus().catch(() => {});
  await page.keyboard.press('KeyR');
  // buy: open each visible tab in turn and press the first enabled cost button
  const tabs = page.locator('.tab:visible');
  const n = await tabs.count();
  if (n > 0) {
    await tabs.nth(tabIdx % n).click();
    tabIdx++;
    const btn = page.locator('#tabbody .btn:not(:disabled)').filter({ hasText: /구매|\+1|고용|성장|함께하기/ }).first();
    if ((await btn.count()) > 0) {
      await btn.click().catch(() => {});
      buys++;
    }
  }
  // trends
  const join = page.locator('#trend .btn:not(:disabled)', { hasText: '참여하기' });
  if ((await join.count()) > 0 && (await join.isVisible())) await join.click().catch(() => {});

  const el = (Date.now() - t0) / 1000;
  if (el - lastLog >= 30) {
    lastLog = el;
    console.log(Math.round(el) + 's', buys, 'buys', JSON.stringify(await read()));
  }
}
await page.screenshot({ path: path.join(OUT, 'p1_realtime.png') });
const before = await read();

// reload restores the same progress
await page.reload();
await page.waitForSelector('#postbtn');
await page.waitForTimeout(800);
const after = await read();
console.log('before reload', JSON.stringify(before.res));
console.log('after reload ', JSON.stringify(after.res));
if (before.res[1] !== after.res[1] && !after.res[1]) errors.push('reload lost followers');

// offline return: before the game boots, pretend the last save was 40 minutes ago
await page.goto('about:blank');
await page.context().addInitScript(() => {
  if (location.protocol.startsWith('http') && !sessionStorage.getItem('mb_offline_done')) {
    sessionStorage.setItem('mb_offline_done', '1');
    const raw = JSON.parse(localStorage.getItem('metricbloom.save'));
    raw.lastTs = Date.now() - 40 * 60 * 1000;
    localStorage.setItem('metricbloom.save', JSON.stringify(raw));
  }
});
await page.goto(BASE);
await page.waitForSelector('#postbtn');
await page.waitForTimeout(800);
const modal = await page.locator('#modal.on h2').textContent().catch(() => null);
console.log('offline modal:', modal, await page.locator('#modal.on .stats').textContent().catch(() => ''));
await page.screenshot({ path: path.join(OUT, 'p2_offline.png') });
await browser.close();
console.log('errors:', errors.length ? errors : 'none');
