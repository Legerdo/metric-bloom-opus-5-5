import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { SAVE_KEY } from '../../src/game/save';
import { CONTINUITY_MULTIPLIER } from '../../src/game/content';
mkdirSync('evidence', { recursive: true });
const consoleErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, context }) => {
  const errors: string[] = []; consoleErrors.set(page, errors);
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Production must not need a CDN, account, model API, or any other external service.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
  });
});
test.afterEach(async ({ page }) => { expect(consoleErrors.get(page) ?? []).toEqual([]); });
async function fixture(page: Page, name: string, elapsedSeconds = 0): Promise<void> {
  const raw = JSON.parse(readFileSync(`evidence/${name}.json`, 'utf8'));
  await page.addInitScript(({ key, state, elapsedSeconds }) => {
    if (!sessionStorage.getItem('test-fixture-installed')) { state.savedAt = Date.now() - elapsedSeconds * 1000; localStorage.setItem(key, JSON.stringify(state)); sessionStorage.setItem('test-fixture-installed', '1'); }
  }, { key: SAVE_KEY, state: raw, elapsedSeconds });
  await page.goto('/');
  await expect(page.locator('#world canvas')).toBeVisible();
  await page.waitForTimeout(600);
}
test('normal-speed first action, purchase, automatic production and refresh recovery', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '창가에 불 켜기' }).click();
  await expect(page.locator('#resource-connection')).toBeHidden();
  await expect(page.locator('#design-tab')).toBeHidden();
  for (let i = 0; i < 4; i++) { await page.locator('#post').click(); await page.waitForTimeout(820); }
  await expect(page.locator('#buy-desk')).toBeEnabled();
  await page.locator('#buy-desk').click();
  await expect(page.locator('#owned-desk')).toContainText('1개 운영');
  await expect(page.locator('#milestone-desk')).toContainText('9개 남음');
  await page.waitForTimeout(2500);
  await expect(page.locator('#rate-attention')).not.toHaveText('+0 / 초');
  await page.screenshot({ path: 'evidence/early.png', fullPage: true });
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('button', { name: '지금 저장', exact: true }).click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(saved.generators.desk).toBe(1); expect(saved.actions).toBe(4); expect(saved.lifetime.attention).toBeGreaterThan(16);
  await page.reload();
  await expect(page.locator('#owned-desk')).toContainText('1개 운영');
  expect(await page.evaluate(() => 'bloomDebug' in window)).toBe(false);
  expect(errors).toEqual([]);
});
test('midgame design controls, network, responsive composition and console', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await fixture(page, 'chapter-6');
  await page.getByRole('button', { name: '설계', exact: true }).click();
  await page.getByRole('button', { name: '깊은 대화', exact: true }).click();
  await expect(page.locator('#focus-description')).toContainText('연결 ×1.65');
  await page.locator('#allocation-1').fill('65');
  await expect(page.locator('#allocation-value-1')).toHaveText('65%');
  const sum = await page.locator('[id^="allocation-value-"]').allTextContents();
  expect(sum.reduce((a, b) => a + parseInt(b), 0)).toBe(100);
  await page.locator('[data-module="library"]').click();
  await page.locator('[data-action="module"][data-value="0"]').click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(saved.modules[0]).toBe('library');
  await page.locator('#bench-content').evaluate(el => el.scrollTop = 0);
  await page.screenshot({ path: 'evidence/mid.png', fullPage: true });
  for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size); await page.waitForTimeout(350);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.locator('#post')).toBeVisible();
    if (size.width > 850) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator('#post')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('#invest')).toBeInViewport({ ratio: 1 });
    }
    await page.screenshot({ path: `evidence/viewport-${size.width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
test('offline resume is capped, summarized and cannot be claimed twice on refresh', async ({ page }) => {
  const before = JSON.parse(readFileSync('evidence/chapter-4.json', 'utf8'));
  await fixture(page, 'chapter-4', 3600);
  await expect(page.locator('#toast')).toContainText('30분');
  const first = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(first.played - before.played).toBeGreaterThanOrEqual(900);
  expect(first.played - before.played).toBeLessThan(903);
  expect(first.lifetime.attention).toBeGreaterThan(before.lifetime.attention);
  await page.reload();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('button', { name: '지금 저장', exact: true }).click();
  const second = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(second.played - first.played).toBeLessThan(10);
});
test('final broadcasting requires a valid route and actual production allocation', async ({ page }) => {
  await fixture(page, 'chapter-10');
  await page.getByRole('button', { name: '설계', exact: true }).click();
  await page.locator('#allocation-1').fill('70');
  await expect(page.locator('#festival-condition')).toContainText('관심 제작 시간을 45% 이상');
  await expect(page.locator('#invest')).toBeDisabled();
  await page.locator('#allocation-0').fill('60');
  await expect(page.locator('#festival-condition')).toContainText('방송 경로가 준비');
  await expect(page.locator('#invest')).toBeEnabled();
  await page.locator('#invest').click();
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(state.festival.progress.attention).toBeGreaterThan(0);
});
test('continuity is an explicit alternative and retains the existing village', async ({ page }) => {
  await fixture(page, 'chapter-6');
  await page.getByRole('button', { name: '설계', exact: true }).click();
  await expect(page.locator('[data-action="continuity"]')).toBeInViewport();
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  await page.locator('[data-action="continuity"]').click();
  await expect(page.locator('#modal-body')).toContainText(`×${CONTINUITY_MULTIPLIER}`);
  await page.getByRole('button', { name: '조금 더 생각하기', exact: true }).click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).continuity, SAVE_KEY)).toBe(false);
  await page.locator('[data-action="continuity"]').click();
  await page.getByRole('button', { name: '연속 제작 협약 맺기', exact: true }).click();
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(after.continuity).toBe(true); expect(after.reborn).toBe(false);
  expect(after.generators).toEqual(before.generators);
  expect(after.modules).toEqual(before.modules);
});
test('independent audio controls and reduced motion survive a refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '창가에 불 켜기' }).click();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('slider', { name: '배경 음악 음량' }).fill('0');
  await page.getByRole('slider', { name: '효과음 음량' }).fill('0.25');
  await page.getByRole('checkbox', { name: '움직임 줄이기' }).check();
  await page.getByRole('button', { name: '지금 저장', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByRole('slider', { name: '배경 음악 음량' })).toHaveValue('0');
  await expect(page.getByRole('slider', { name: '효과음 음량' })).toHaveValue('0.25');
  await expect(page.getByRole('checkbox', { name: '움직임 줄이기' })).toBeChecked();
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
});
test('late game and ending through the real launch control', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await fixture(page, 'before-ending');
  await page.getByRole('button', { name: '설계', exact: true }).click();
  await page.screenshot({ path: 'evidence/late.png', fullPage: true });
  await page.getByRole('button', { name: '개화제 개막하기', exact: true }).click();
  await expect(page.locator('#dialog-title')).toHaveText('모든 신호가 꽃이 된 밤');
  await expect(page.locator('#modal-body')).toContainText('본편 완료');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'evidence/ending.png', fullPage: true });
  await page.getByRole('button', { name: '완성된 마을 둘러보기', exact: true }).click();
  await expect(page.locator('#project')).toContainText('본편 완료');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(saved.ended).toBe(true); expect(saved.festival.completed).toEqual([true, true, true]);
  await page.reload(); await expect(page.locator('#project')).toContainText('본편 완료');
  expect(errors).toEqual([]);
});

test('real meta confirmation selects one irreversible growth path', async ({ page }) => {
  await fixture(page, 'chapter-6');
  await page.getByRole('button', { name: '설계', exact: true }).click();
  await page.getByRole('button', { name: /새 계절 살펴보기/ }).click();
  await expect(page.locator('#modal-body')).toContainText('작업대 25');
  await page.getByRole('button', { name: '새 계절 시작', exact: true }).click();
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(save.reborn).toBe(true); expect(save.continuity).toBe(false); expect(save.seeds).toBeGreaterThanOrEqual(3);
  expect(save.generators.desk).toBe(25); expect(save.chapter).toBe(6); expect(save.modules.filter(Boolean).length).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /새 계절 살펴보기/ })).toHaveCount(0);
  await page.screenshot({ path: 'evidence/renewal.png', fullPage: true });
});
test('save export and validated file import are functional UI flows', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '창가에 불 켜기' }).click();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '저장 내보내기' }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe('metric-bloom-save.json');
  const raw = JSON.parse(readFileSync('evidence/chapter-3.json', 'utf8')); raw.milestones.push({ name: '<img src=x onerror=alert(1)>', time: 1 });
  const chooserPromise = page.waitForEvent('filechooser'); await page.getByRole('button', { name: '저장 불러오기' }).click();
  const chooser = await chooserPromise; await chooser.setFiles({ name: 'garden.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(raw)) });
  await expect(page.locator('#dialog-title')).toHaveText('이 정원을 불러올까요?');
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await expect(page.locator('#resource-insight')).toBeVisible();
  await page.getByRole('button', { name: '발자취', exact: true }).click();
  await expect(page.locator('.journal')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.journal img')).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY); expect(saved.chapter).toBe(3);
});
test('a second tab cannot silently overwrite a running garden', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '창가에 불 켜기' }).click();
  await page.evaluate(() => localStorage.setItem('unrelated-app', 'keep'));
  const other = await page.context().newPage(); await other.goto('/');
  await other.getByRole('button', { name: '설정', exact: true }).click();
  await other.getByRole('button', { name: '지금 저장', exact: true }).click();
  await expect(page.locator('#dialog-title')).toHaveText('다른 창에서 정원을 가꾸고 있어요');
  expect(await page.evaluate(() => localStorage.getItem('unrelated-app'))).toBe('keep'); await other.close();
});
