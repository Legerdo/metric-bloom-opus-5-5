// Isolated browser QA against the built app. Mid/late saves are progressed by
// the real simulation, then imported through Settings; no debug hooks are used.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { runBot } from '../src/sim/bot';
import { pendingEpisode } from '../src/econ/narrative';
import { encodeExport, deserialize } from '../src/econ/save';
import { echoRoute } from '../src/content/echo';
import type { GameState } from '../src/econ/state';

const url = process.argv[2] || 'http://127.0.0.1:4174/';
const shots = resolve('shots/update');
mkdirSync(shots, { recursive: true });
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert(executablePath, 'Chrome or Edge required');
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const ready = async () => { await page.locator('#postbtn').waitFor(); await page.waitForTimeout(400); };
const screenshot = async (name: string) => page.screenshot({ path: resolve(shots, `${name}.png`) });
const readSave = async () => deserialize((await page.evaluate(() => localStorage.getItem('metricbloom.save')))! )!;
async function importSave(s: GameState) {
  s.lastTs = Date.now();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('textbox', { name: '저장 코드' }).fill(encodeExport(s));
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForEvent('load');
  await ready();
}

async function layout(label: string) {
  const issues = await page.evaluate(`(() => {
    const problems = [];
    const rect = (el) => el.getBoundingClientRect();
    const within = (e, box) => {
      const a = rect(e), b = rect(box);
      return a.left >= b.left - 2 && a.right <= b.right + 2 && a.top >= b.top - 2 && a.bottom <= b.bottom + 2;
    };
    const stage = document.getElementById('stage');
    for (const sel of ['canvas', '#goal', '#postbtn', '#trend.on', '#viewtoggle.on']) {
      const e = stage.querySelector(sel);
      if (e && !within(e, stage)) problems.push(sel + ' outside stage');
    }
    const overlap = (a, b) => { const x = rect(a), y = rect(b); return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top; };
    const canvas = stage.querySelector('canvas');
    for (const sel of ['#goal', '#postbtn', '#trend.on', '#viewtoggle.on']) {
      const e = stage.querySelector(sel);
      if (e && overlap(canvas, e)) problems.push(sel + ' covers canvas');
    }
    const tab = document.getElementById('tabbody');
    const goal = document.querySelector('#goal .gt');
    if (goal.scrollWidth > goal.clientWidth + 2 || goal.scrollHeight > goal.clientHeight + 2) problems.push('goal text clipped');
    if (tab.clientHeight < 55) problems.push('panel too short');
    if (tab.scrollWidth > tab.clientWidth + 2) problems.push('panel horizontal overflow ' + tab.scrollWidth + '/' + tab.clientWidth);
    if (document.documentElement.scrollWidth > innerWidth + 2) problems.push('page horizontal overflow');
    const panel = document.getElementById('panel');
    if (rect(panel).bottom > Math.max(innerHeight, 580) + 2) problems.push('panel below app');
    return problems;
  })()`);
  assert.deepEqual(issues, [], `${label}: ${issues.join(', ')}`);
}

try {
  await page.goto(url);
  await ready();
  assert.equal(await page.evaluate(() => '__mb' in window), false, 'production entry point');
  for (let i = 0; i < 18; i++) {
    await page.locator('#postbtn').click();
    await page.waitForTimeout(130);
  }
  await page.getByRole('tab', { name: '작업실' }).click();
  await page.locator('#tabbody .btn:not(:disabled)').first().click();
  for (let i = 0; i < 5; i++) {
    await page.locator('#postbtn').click();
    await page.waitForTimeout(140);
  }
  await page.getByRole('tab', { name: '루틴' }).click();
  await page.locator('#tabbody .btn:not(:disabled)').filter({ hasText: '+1' }).first().click();
  await page.waitForTimeout(1000);
  await screenshot('01-real-start');
  console.log('PASS normal posting and first purchases');

  const draft = runBot('typical', 60, 42, (s) => !!pendingEpisode(s)).state;
  assert.equal(pendingEpisode(draft)?.id, 'draft');
  await importSave(draft);
  await page.reload();
  await ready();
  await page.locator('#story-inbox.pending').click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  assert(await page.locator('#story-inbox.pending').isVisible(), 'dismiss must preserve decision');
  await page.locator('#story-inbox').click();
  await page.keyboard.press('Shift+Tab');
  assert(await page.locator('#modal').evaluate((e) => e.contains(document.activeElement)));
  await page.locator('#modal .box').evaluate((e) => { e.scrollTop = 0; });
  await screenshot('02-unwritten-post');
  const beforeReading = (await readSave()).meta.totalTime;
  await page.waitForTimeout(11000); // includes the normal autosave interval
  assert((await readSave()).meta.totalTime - beforeReading < 3, 'reading must pause simulation');
  await page.locator('[data-choice="check"]').click();
  assert((await readSave()).meta.narrative.choices[0] === 'check');
  await page.getByRole('button', { name: '닫기', exact: true }).click();

  const inbox = runBot('typical', 60, 42, (s) => !!pendingEpisode(s), await readSave()).state;
  assert.equal(pendingEpisode(inbox)?.id, 'inbox');
  await importSave(inbox);
  await page.locator('#story-inbox').click();
  await page.locator('[data-choice="pin"]').click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();

  const identity = runBot('typical', 90, 42, (s) => !!pendingEpisode(s), await readSave()).state;
  assert.equal(pendingEpisode(identity)?.id, 'identity');
  for (const route of ['voice', 'duet', 'echo'] as const) {
    await importSave(structuredClone(identity));
    await page.locator('#story-inbox').click();
    await page.locator(`[data-choice="${route}"]`).click();
    assert.equal(echoRoute((await readSave()).meta.narrative.choices), route);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.reload();
    await ready();
    assert.equal(echoRoute((await readSave()).meta.narrative.choices), route);
  }
  console.log('PASS three episodes, three route selections, dismissal, save/reload');

  // A normal simulation continuation supplies late UI, never fabricated currency.
  const late = runBot('typical', 180, 42, (s) => s.run.festival, await readSave()).state;
  assert(late.run.festival);
  await importSave(late);
  for (const [width, height] of [[1366, 768], [1024, 600], [820, 700], [768, 1024], [390, 844], [360, 640], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    const tabs = page.getByRole('tab');
    for (let i = 0; i < await tabs.count(); i++) {
      if (!await tabs.nth(i).isVisible()) continue;
      await tabs.nth(i).click();
      await page.waitForTimeout(150);
      await layout(`${width}x${height}, ${await tabs.nth(i).innerText()}`);
    }
    await screenshot(`03-late-${width}x${height}`);
  }
  console.log('PASS all late-game tabs at 8 viewport sizes');

  await page.setViewportSize({ width: 360, height: 640 });
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByText('큰 글씨', { exact: true }).click();
  await page.getByText('화면 효과 줄이기', { exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.waitForTimeout(250);
  await layout('large text');
  await screenshot('04-large-text');
  await importSave(structuredClone(identity));
  await page.locator('#story-inbox').click();
  await page.keyboard.press('Tab');
  assert(await page.locator('#modal').evaluate((e) => e.contains(document.activeElement)));
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  assert(await page.locator('#modal').evaluate((e) => e.contains(document.activeElement)));
  await screenshot('05-mobile-story');
  await page.locator('[data-choice="duet"]').click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  console.log('PASS large text, reduced effects, small-screen choices and keyboard focus');
  const nearEnd = runBot('typical', 180, 42, (s) => s.run.festivalGauge >= 0.998, await readSave()).state;
  assert(nearEnd.run.festivalGauge >= 0.998);
  await importSave(nearEnd);
  await page.locator('#ending.show').waitFor({ timeout: 15000 });
  assert(await page.locator('#ending').innerText().then((text) => text.includes('서로 다른 서명')));
  await screenshot('06-mobile-ending');
  await page.getByRole('button', { name: '계속 둘러보기', exact: true }).click();
  assert.equal((await readSave()).meta.endingSeen, true);
  assert.equal(await page.locator('#app').evaluate((e) => e.inert), false);
  console.log('PASS actual ending trigger, route epilogue and return to play');
  assert.deepEqual(errors, [], 'browser console errors');
} catch (error) {
  await screenshot('failure');
  throw error;
} finally {
  await browser.close();
}
