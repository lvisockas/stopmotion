// End to end: load the editor in headless Chrome, add a slide with 3
// generated placeholder screenshots, export it, and check the MP4 against
// the Instagram spec. Then export all slides as a ZIP and reload to check
// the project persisted.
//
//   npm run test:e2e        (needs a Chrome with H.264: tests/e2e/get-chrome.sh)
import { createCanvas } from '@napi-rs/canvas';
import { unzipSync } from 'fflate';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { startEnv } from './browser.mjs';
import { assertSpec, ffprobeSummary, inspectMp4 } from './inspect.mjs';

const OUT = 'test-results';
mkdirSync(OUT, { recursive: true });

function placeholderPng(i) {
  const w = [1200, 1080, 900][i % 3];
  const h = [630, 1350, 900][i % 3];
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ['#b91c1c', '#1d4ed8', '#15803d'][i % 3];
  ctx.fillRect(0, 0, w, 80);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(`Placeholder ${i + 1}`, 40, 200);
  const file = `${OUT}/placeholder-${i + 1}.png`;
  writeFileSync(file, c.toBuffer('image/png'));
  return file;
}

function step(msg) {
  console.log(`• ${msg}`);
}

const env = await startEnv();
const failures = [];
try {
  const context = await env.browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  await page.goto(env.url);
  await page.waitForSelector('[data-testid=preview-canvas]');
  step(`editor loaded (${env.executablePath})`);

  // first visit opens the family-trip story; settled slides export like any other
  await page.waitForFunction(() => document.querySelectorAll('.slides li').length === 10);
  step('family-trip demo: 10 story slides');
  await page.click('.slides li:nth-child(2)');
  {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid=export-one]')]);
    await dl.saveAs(`${OUT}/story-${dl.suggestedFilename()}`);
    assertSpec(await inspectMp4(new Uint8Array(readFileSync(`${OUT}/story-${dl.suggestedFilename()}`))), { duration: 9 });
    step(`story slide export: ${dl.suggestedFilename()} (settled opening, scene, props, bubbles) matches spec`);
  }

  // the AI-news demo is one pick away
  const news = JSON.parse(readFileSync('public/demo/news.json', 'utf8'));
  await page.selectOption('.demo-picker', 'ai-news');
  const expected = 1 + Math.min(9, news.headlines.length);
  await page.waitForFunction((n) => document.querySelectorAll('.slides li').length === n, expected);
  await page.waitForFunction(() => document.querySelectorAll('.images li img').length === 3);
  step(`AI-news demo: cover + ${expected - 1} headline slides`);
  await page.screenshot({ path: `${OUT}/demo.png` });

  // a comic slide (characters + speech bubbles) exports like any other
  const comicIndex = news.headlines.findIndex((h) => h.publisher === 'MIT Technology Review');
  if (comicIndex >= 0) {
    await page.click(`.slides li:nth-child(${comicIndex + 2})`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid=export-one]')]);
    await dl.saveAs(`${OUT}/comic-${dl.suggestedFilename()}`);
    assertSpec(await inspectMp4(new Uint8Array(readFileSync(`${OUT}/comic-${dl.suggestedFilename()}`))), { duration: 9 });
    step(`comic slide export: ${dl.suggestedFilename()} matches spec`);
  }

  await page.click('text=New project');
  await page.waitForFunction(() => document.querySelectorAll('.slides li').length === 1);

  const files = [0, 1, 2].map(placeholderPng);
  await page.setInputFiles('[data-testid=file-input]', files);
  await page.waitForFunction(() => document.querySelectorAll('.images li').length === 3);
  await page.fill('[data-testid=title-input]', 'Savaitės antraštės: ąčęėįšųūž');
  step('added 3 placeholder screenshots + a Lithuanian title');

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid=export-one]')]);
  const name = download.suggestedFilename();
  await download.saveAs(`${OUT}/${name}`);
  const info = await inspectMp4(new Uint8Array(readFileSync(`${OUT}/${name}`)));
  console.log(name, info);
  console.log(ffprobeSummary(`${OUT}/${name}`) ?? '(no ffprobe/ffmpeg on PATH; set FFPROBE or FFMPEG)');
  if (name !== '01.mp4') failures.push(`single export named ${name}, expected 01.mp4`);
  assertSpec(info, { duration: 6 });
  step('export this slide: MP4 matches spec');

  // second slide, shorter, then export all as a ZIP
  await page.click('.add-slide');
  await page.setInputFiles('[data-testid=file-input]', [files[1]]);
  await page.waitForFunction(() => document.querySelectorAll('.images li').length === 1);
  await page.$eval('.inspector input[type=range]', (el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, '4');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const [zipDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.click('[data-testid=export-all]'),
  ]);
  await zipDownload.saveAs(`${OUT}/carousel.zip`);
  const entries = unzipSync(new Uint8Array(readFileSync(`${OUT}/carousel.zip`)));
  const names = Object.keys(entries).sort();
  if (names.join(',') !== '01.mp4,02.mp4') failures.push(`zip contains ${names}`);
  assertSpec(await inspectMp4(entries['01.mp4']), { duration: 6 });
  assertSpec(await inspectMp4(entries['02.mp4']), { duration: 4 });
  step(`export all: carousel.zip has ${names.join(', ')}, both match spec`);

  // persistence across reload (settings in localStorage, images in IndexedDB)
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.slides li').length === 2);
  await page.click('.slides li:first-child');
  await page.waitForFunction(() => document.querySelectorAll('.images li img').length === 3);
  const title = await page.inputValue('[data-testid=title-input]');
  if (title !== 'Savaitės antraštės: ąčęėįšųūž') failures.push(`title after reload: ${title}`);
  step('project restored after reload');

  await page.screenshot({ path: `${OUT}/editor.png` });
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('e2e OK');
} finally {
  await env.close();
}
