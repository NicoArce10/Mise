// Batch-export every demo card to a 1920x1080 PNG.
//
// Usage:
//   cd docs/demo
//   npm install --no-save playwright
//   npx playwright install --with-deps chromium
//   node export-cards.mjs
//
// Output: card-01.png … card-04.png next to this file.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CARDS_URL = `file://${join(__dirname, 'cards.html').replace(/\\/g, '/')}`;
const TOTAL = 4;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

for (let n = 1; n <= TOTAL; n++) {
  const url = `${CARDS_URL}#${n}`;
  await page.goto(url, { waitUntil: 'load' });
  // Give the webfonts a tick to finish loading.
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    document.getElementById('hud')?.setAttribute('hidden', '');
  });
  await page.waitForTimeout(150);
  const out = join(__dirname, `card-${String(n).padStart(2, '0')}.png`);
  await page.screenshot({ path: out, fullPage: false, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log(`wrote ${out}`);
}

await browser.close();
console.log('done — 4 cards exported (hook A + hook B + wordmark + closing)');
