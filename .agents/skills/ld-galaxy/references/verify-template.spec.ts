// ld-galaxy verification template. Copy to app/tests/galaxy-verify.spec.ts,
// replace the three EXPECTED_* values with the numbers build_galaxy.py printed,
// run `cd app && npx playwright test tests/galaxy-verify.spec.ts --reporter=list`,
// then DELETE the spec and app/test-results/. Do not commit it.
//
// Requires the dev server on http://localhost:3200 (launch.json "stemrobin-dev").
import { test, expect } from '@playwright/test';

const EXPECTED_STARS = 1249; // build_galaxy.py: stars=
const EXPECTED_HUBS = 47; // build_galaxy.py: hubs=  (== KMeans K)
// Hub names that must exist, in the site's default locale (en) — pick 2–3
// NAMES_EN entries covering whatever this rebuild changed:
const EXPECTED_HUB_LABELS = ['Events & Probability', 'Derivatives', 'Force & Motion'];

test('knowledge galaxy renders the rebuilt galaxy.json', async ({ page }) => {
  await page.goto('http://localhost:3200/');

  const galaxy = page.locator('.sr-galaxy');
  await galaxy.scrollIntoViewIfNeeded();

  // lazy three.js init: canvas appears once the section scrolls into view
  await expect(page.locator('.sr-galaxy-canvas')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.sr-galaxy-hublabel')).toHaveCount(EXPECTED_HUBS, {
    timeout: 10000,
  });

  const labels = await page.locator('.sr-galaxy-hublabel').allTextContents();
  for (const name of EXPECTED_HUB_LABELS) expect(labels).toContain(name);

  const stats = await page.evaluate(async () => {
    const g = await (await fetch('/galaxy.json')).json();
    const byBranch: Record<string, number> = {};
    for (const s of g.stars) byBranch[s.branch] = (byBranch[s.branch] ?? 0) + 1;
    return { stars: g.stars.length, hubs: g.hubs.length, byBranch };
  });
  expect(stats.stars).toBe(EXPECTED_STARS);
  expect(stats.hubs).toBe(EXPECTED_HUBS);

  await galaxy.screenshot({ path: 'test-results/galaxy-verify.png' });
});
