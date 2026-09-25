/**
 * Dev-only entry (render.html) for scripts/render-job.mjs: renders a
 * project from local files through the exact same drawFrame + encoder the
 * editor uses, without the files ever touching the app's storage.
 */
import { loadFonts } from './assets/fonts';
import { decodeBlob, lookupAsset } from './assets/images';
import { encodeSlide } from './export/encoder';
import { sanitizeSlide } from './model/slide';
import { drawFrame, HEIGHT, WIDTH, type Slide } from './render';

async function toBase64(bytes: Uint8Array): Promise<string> {
  const blob = new Blob([bytes as BlobPart]);
  const url: string = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(',') + 1);
}

async function load(images: Record<string, string>): Promise<void> {
  await loadFonts();
  for (const [id, dataUrl] of Object.entries(images)) {
    await decodeBlob(id, await (await fetch(dataUrl)).blob());
  }
}

/** Encodes each slide; returns base64 MP4s. */
async function render(slides: Partial<Slide>[], images: Record<string, string>, bitrate?: number): Promise<string[]> {
  await load(images);
  const out: string[] = [];
  for (const s of slides) out.push(await toBase64(await encodeSlide(sanitizeSlide(s), lookupAsset, { bitrate })));
  return out;
}

/** One frame as a PNG data URL, for reviewing a composition before encoding. */
async function frame(slide: Partial<Slide>, index: number, images: Record<string, string>): Promise<string> {
  await load(images);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  drawFrame(canvas.getContext('2d')!, sanitizeSlide(slide), index, lookupAsset);
  return canvas.toDataURL('image/png');
}

Object.assign(window, { __renderJob: { render, frame } });
