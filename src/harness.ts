import { loadFonts } from './assets/fonts';
import { decodeBlob, lookupAsset } from './assets/images';
import { checkEncoderSupport, encodeSlide } from './export/encoder';
import { downloadBytes } from './export/zip';
import { createSlide } from './model/slide';
import { placeholderScreenshot } from './placeholders';
import { drawFrame, totalFrames, type SlideImage } from './render';

async function setup() {
  await loadFonts();
  const images: SlideImage[] = [];
  for (let i = 0; i < 3; i++) {
    const id = `ph${i}`;
    const img = await decodeBlob(id, await placeholderScreenshot(i));
    images.push({ id, name: `${id}.png`, width: img.naturalWidth, height: img.naturalHeight });
  }
  return createSlide({
    seed: 1234,
    images,
    title: 'Savaitės antraštės: ąčęėįšųūž',
    subtitle: 'Three headlines, tossed onto the table one by one.',
  });
}

const ready = setup();
const status = document.getElementById('status')!;
const canvas = document.getElementById('preview') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

ready.then((slide) => {
  let start = performance.now();
  const loop = () => {
    const f = Math.floor(((performance.now() - start) / 1000) * 30);
    if (f >= totalFrames(slide)) start = performance.now();
    drawFrame(ctx, slide, f % totalFrames(slide), lookupAsset);
    requestAnimationFrame(loop);
  };
  loop();
});

async function run(): Promise<Uint8Array> {
  const slide = await ready;
  const support = await checkEncoderSupport();
  status.textContent = support.ok ? `encoding with ${support.codec}` : support.reason;
  const t0 = performance.now();
  const bytes = await encodeSlide(slide, lookupAsset, {
    onProgress: (p) => (status.textContent = `${Math.round(p * 100)}%`),
  });
  status.textContent = `done: ${bytes.length} bytes in ${Math.round(performance.now() - t0)} ms`;
  return bytes;
}

document.getElementById('export')!.addEventListener('click', async () => {
  downloadBytes(await run(), 'test.mp4', 'video/mp4');
});

Object.assign(window, { __harness: { run, checkEncoderSupport } });
