import { createCanvas, GlobalFonts, type Canvas, type SKRSContext2D } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setCanvasFactory, type Ctx2D, type DrawableImage } from '../../src/render';

const fontDir = fileURLToPath(new URL('../../node_modules/@fontsource/inter/files/', import.meta.url));
for (const w of [500, 800]) {
  for (const subset of ['latin', 'latin-ext']) {
    GlobalFonts.registerFromPath(`${fontDir}inter-${subset}-${w}-normal.woff2`, 'Inter');
  }
}

GlobalFonts.registerFromPath(
  fileURLToPath(new URL('../../node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-ext-400-normal.woff2', import.meta.url)),
  'Patrick Hand',
);
GlobalFonts.registerFromPath(
  fileURLToPath(new URL('../../node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2', import.meta.url)),
  'Patrick Hand',
);

setCanvasFactory((w, h) => {
  const canvas = createCanvas(w, h);
  return { canvas: canvas as unknown as DrawableImage, ctx: canvas.getContext('2d') as unknown as Ctx2D };
});

export function frameCanvas(): { canvas: Canvas; ctx: Ctx2D } {
  const canvas = createCanvas(1080, 1350);
  return { canvas, ctx: canvas.getContext('2d') as unknown as Ctx2D };
}

export function hashCanvas(canvas: Canvas): string {
  const ctx = canvas.getContext('2d') as SKRSContext2D;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return createHash('sha256').update(data).digest('hex');
}

/** A fake "headline screenshot" drawn with node-canvas. */
export function fakeScreenshot(i: number, w = 1200, h = 630): DrawableImage {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ['#c0392b', '#2980b9', '#27ae60'][i % 3];
  ctx.fillRect(0, 0, w, 70);
  ctx.fillStyle = '#111';
  ctx.font = '800 60px Inter';
  ctx.fillText(`Headline ${i + 1} ąčęėįšųūž`, 30, 170);
  return c as unknown as DrawableImage;
}
