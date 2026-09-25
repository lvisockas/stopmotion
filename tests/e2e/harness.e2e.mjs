// Milestone check: the hardcoded harness slide exports to a valid MP4.
import { writeFileSync, mkdirSync } from 'node:fs';
import { startEnv } from './browser.mjs';
import { assertSpec, ffprobeSummary, inspectMp4 } from './inspect.mjs';

const env = await startEnv();
try {
  const page = await env.browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e));
  await page.goto(`${env.url}harness.html`);
  const b64 = await page.evaluate(async () => {
    const bytes = await window.__harness.run();
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const bytes = Buffer.from(b64, 'base64');
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/harness.mp4', bytes);
  const info = await inspectMp4(new Uint8Array(bytes));
  console.log(info);
  console.log(ffprobeSummary('test-results/harness.mp4') ?? '(no ffprobe/ffmpeg)');
  assertSpec(info, { duration: 6 });
  console.log('harness export OK');
} finally {
  await env.close();
}
