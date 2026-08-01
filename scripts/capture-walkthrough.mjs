import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = path.resolve('store-assets/walkthrough-video/frames');
fs.mkdirSync(OUT, { recursive: true });

const brave = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

const browser = await chromium.launch({
  executablePath: brave,
  headless: true,
  args: ['--disable-gpu', '--no-sandbox'],
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

async function shot(name, doFn) {
  await doFn();
  await page.waitForTimeout(800);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name);
}

await page.goto('https://playin432.com/', { waitUntil: 'networkidle', timeout: 60000 });
// clear shell preference so homepage shows
await page.evaluate(() => {
  try { sessionStorage.clear(); localStorage.removeItem('playin432_shell'); } catch {}
});
await page.goto('https://playin432.com/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);

await shot('01-hero.png', async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
});

await shot('02-start-cards.png', async () => {
  const el = page.locator('.landing-start-grid, .landing-start-label').first();
  if (await el.count()) await el.scrollIntoViewIfNeeded();
  else await page.evaluate(() => window.scrollBy(0, 400));
});

await shot('03-truth.png', async () => {
  const h = page.getByRole('heading', { name: /Built for listeners/i });
  if (await h.count()) await h.scrollIntoViewIfNeeded();
  else await page.evaluate(() => window.scrollBy(0, 700));
});

await shot('04-frequencies.png', async () => {
  const h = page.getByRole('heading', { name: /Ten tones|Frequencies/i });
  if (await h.count()) await h.scrollIntoViewIfNeeded();
  else await page.evaluate(() => window.scrollBy(0, 800));
});

await shot('05-what-you-get.png', async () => {
  const h = page.getByRole('heading', { name: /What you get/i });
  if (await h.count()) await h.scrollIntoViewIfNeeded();
});

await shot('06-steps.png', async () => {
  const h = page.getByRole('heading', { name: /Three steps/i });
  if (await h.count()) await h.scrollIntoViewIfNeeded();
});

await shot('07-vs.png', async () => {
  const h = page.getByRole('heading', { name: /Not another/i });
  if (await h.count()) await h.scrollIntoViewIfNeeded();
});

await shot('08-hear-difference.png', async () => {
  const h = page.locator('h2.landing-h2', { hasText: /Hear the difference/i }).first();
  if (await h.count()) await h.scrollIntoViewIfNeeded();
});

await shot('09-pricing.png', async () => {
  const p = page.locator('#pricing, .landing-pricing').first();
  if (await p.count()) await p.scrollIntoViewIfNeeded();
  else {
    const h = page.getByRole('heading', { name: /Free to listen|Pricing/i }).first();
    if (await h.count()) await h.scrollIntoViewIfNeeded();
  }
});

await shot('10-faq.png', async () => {
  const h = page.getByRole('heading', { name: /Questions/i }).first();
  if (await h.count()) await h.scrollIntoViewIfNeeded();
});

// Open player
const openBtn = page.getByRole('button', { name: /Open player|Skip to player|Explore/i }).first();
if (await openBtn.count()) {
  await openBtn.click();
  await page.waitForTimeout(1200);
  await shot('11-player.png', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
  });
}

// Back home if brand button
const brand = page.locator('button.brand, .brand-btn').first();
if (await brand.count()) {
  await brand.click();
  await page.waitForTimeout(800);
}

await shot('12-final-cta.png', async () => {
  const h = page.getByRole('heading', { name: /Ready when you are/i }).first();
  if (await h.count()) await h.scrollIntoViewIfNeeded();
  else await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
});

await browser.close();
console.log('done');
