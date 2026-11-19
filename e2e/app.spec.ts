import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/** A made-up backup: 3 sessions (boulder, kilter, route), 8 outcomes. Not real data. */
const BACKUP = fileURLToPath(new URL('./fixtures/backup.json', import.meta.url));

async function importBackup(page: Page) {
  page.on('dialog', (dialog) => dialog.accept()); // the menu still confirms with alert/confirm
  await page.locator('#openMenuBtn').click();
  await page.locator('#importFileInput').setInputFiles(BACKUP);
  await expect(page.locator('.group-container')).toHaveCount(3);
}

test('starts empty, logs a first attempt, and keeps it after a reload', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('#problemScreen')).toBeHidden();

  await page.locator('#newAttemptBtn').click();
  const sheet = page.locator('#attemptSheet .modal-sheet');
  await expect(sheet).toBeVisible();
  await page.locator('#locationInput').fill('Demo Gym');
  await page.locator('#field-grade').fill('6a');
  await page.locator('#outcomeInput').fill('Flash');
  await page.locator('#newOutcomeChips .chip', { hasText: 'flash' }).first().click();

  // closed (a closed sheet slides off screen and turns transparent; it stays in the page)
  await expect(page.locator('#attemptSheet')).not.toHaveClass(/active/);
  await expect(page.locator('.attempt-card')).toHaveCount(1);
  await expect(page.locator('.attempt-card')).toContainText('6a');
  await page.reload();
  await expect(page.locator('.attempt-card')).toContainText('flash');
});

test('imports a backup: sessions newest first, only the newest expanded', async ({ page }) => {
  await page.goto('');
  await importBackup(page);
  const headers = page.locator('.group-header');
  await expect(headers.first()).toHaveText(/^\w{3} \d+ • route • Crag Hall$/);
  await expect(page.locator('.group-container').first().locator('.attempt-card')).toHaveCount(3);
  // collapsed groups build no cards
  await expect(page.locator('.attempt-card')).toHaveCount(3);
  await headers.nth(1).click();
  await expect(page.locator('.attempt-card')).toHaveCount(7);
});

test('layout on a phone: sheet at the top, one-line chip rows that scroll', async ({ page }) => {
  await page.goto('');
  await importBackup(page);
  await page.locator('#newAttemptBtn').click();
  const box = await page.locator('#attemptSheet .modal-sheet').boundingBox();
  expect(box!.y).toBeLessThan(10); // opens from the top

  const row = page.locator('#outcomeChips');
  await expect(row.locator('.chip')).toHaveCount(8);
  // all chips on one line, and more than fit: the row scrolls and fades on the right
  const tops = await row
    .locator('.chip')
    .evaluateAll((chips) => chips.map((c) => (c as HTMLElement).offsetTop));
  expect(new Set(tops).size).toBe(1);
  const widths = await row.evaluate((r) => ({ scroll: r.scrollWidth, client: r.clientWidth }));
  expect(widths.scroll).toBeGreaterThan(widths.client);
  await expect(row).toHaveClass(/scroll-fade-right/);

  // chips are big enough to tap
  const chip = await row.locator('.chip').first().boundingBox();
  expect(chip!.height).toBeGreaterThanOrEqual(48);
  expect(chip!.width).toBeGreaterThanOrEqual(64);
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('header h1')).toHaveText('Climbing Log');
  await expect(page.locator('.empty-state')).toBeVisible();
});

test('unusable saved data shows only the problem screen; Start fresh needs two taps', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('clog', '{oops');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('');
  await expect(page.locator('#problemScreen')).toBeVisible();
  await expect(page.locator('#problemList')).toContainText('not valid JSON');
  await expect(page.locator('#mainContent')).toBeHidden();
  await expect(page.locator('#newAttemptBtn')).toBeHidden();

  const startFresh = page.locator('#startFreshBtn');
  await startFresh.click();
  await expect(startFresh).toHaveText('Tap again to delete saved data');
  await startFresh.click();
  await expect(page.locator('#problemScreen')).toBeHidden();
  await expect(page.locator('.empty-state')).toBeVisible();
});
