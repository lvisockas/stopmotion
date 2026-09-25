// Renders a job file to MP4s (and optional preview frames) in headless Chrome,
// through the app's own renderer and encoder.
//
//   node scripts/render-job.mjs job.json out/ [--frames 0,60,239]
//
// job.json: { "slides": [ <Slide fields> ], "images": { "<id>": "path/to/file.png" }, "bitrate"?: 4200000 }
// Image paths are relative to the job file. Nothing is written to the app's storage.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { startEnv } from '../tests/e2e/browser.mjs';

const [jobPath, outDir = 'render-out', flag, frameList] = process.argv.slice(2);
if (!jobPath) throw new Error('usage: node scripts/render-job.mjs job.json out/ [--frames 0,60]');
const job = JSON.parse(readFileSync(jobPath, 'utf8'));
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const images = Object.fromEntries(
  Object.entries(job.images ?? {}).map(([id, p]) => {
    const file = resolve(dirname(jobPath), p);
    return [id, `data:${MIME[extname(file).toLowerCase()] ?? 'image/png'};base64,${readFileSync(file).toString('base64')}`];
  }),
);
mkdirSync(outDir, { recursive: true });

const env = await startEnv();
try {
  const page = await env.browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`${env.url}render.html`);
  await page.waitForFunction(() => window.__renderJob);
  if (flag === '--frames') {
    for (const [si, slide] of job.slides.entries()) {
      for (const f of frameList.split(',').map(Number)) {
        const url = await page.evaluate(([s, f, im]) => window.__renderJob.frame(s, f, im), [slide, f, images]);
        const file = `${outDir}/frame-${String(si + 1).padStart(2, '0')}-${f}.png`;
        writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
        console.log(file);
      }
    }
  } else {
    const videos = await page.evaluate(([s, im, br]) => window.__renderJob.render(s, im, br), [job.slides, images, job.bitrate]);
    videos.forEach((b64, i) => {
      const file = `${outDir}/${String(i + 1).padStart(2, '0')}.mp4`;
      writeFileSync(file, Buffer.from(b64, 'base64'));
      console.log(file);
    });
  }
} finally {
  await env.close();
}
