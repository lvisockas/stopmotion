import { startEnv } from './browser.mjs';
const OUT = '/tmp/claude-0/-home-user-ao/ff16ce74-e04f-5253-95fc-489ba3ad3f0e/scratchpad';
const env = await startEnv();
const page = await env.browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(env.url);
await page.waitForFunction(() => document.querySelectorAll('.slides li').length === 10);
await page.waitForTimeout(500);
await page.click('[aria-label=Pause]');
const scrub = (v) => page.$eval('[aria-label=Scrub]', (el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v === 'max' ? el.max : String(v));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, v);
const frame = process.argv[2] ?? 'max';
for (let i = 1; i <= 10; i++) {
  await page.click(`.slides li:nth-child(${i})`);
  await scrub(frame);
  await page.waitForTimeout(250);
  await page.locator('[data-testid=preview-canvas]').screenshot({ path: `${OUT}/s${i}.png` });
}
console.log('errors', errs);
await env.close();
