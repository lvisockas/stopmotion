import { describe, expect, it } from 'vitest';
import { createSlide } from '../../src/model/slide';
import { drawFrame, getLayout, HEIGHT, SAFE_MARGIN, WIDTH, type Slide } from '../../src/render';
import { fakeScreenshot, frameCanvas, hashCanvas } from './setup';

const shots = [0, 1, 2].map((i) => fakeScreenshot(i));
const assets = (id: string) => shots[Number(id.slice(3))];

function sample(overrides: Partial<Slide> = {}): Slide {
  return createSlide({
    id: 'fixed',
    seed: 42,
    title: 'Savaitės antraštės: ąčęėįšųūž',
    subtitle: 'Three headlines, tossed onto the table one by one.',
    images: [0, 1, 2].map((i) => ({ id: `img${i}`, name: `${i}.png`, width: 1200, height: 630 })),
    effects: { paper: true, grain: true, vignette: true, flicker: true },
    ...overrides,
  });
}

function render(slide: Slide, frame: number): string {
  const { canvas, ctx } = frameCanvas();
  drawFrame(ctx, slide, frame, assets);
  return hashCanvas(canvas);
}

describe('drawFrame determinism', () => {
  it('same seed + frameIndex gives identical pixels, twice', () => {
    for (const frame of [0, 15, 47, 100, 179]) {
      // structurally equal but distinct objects: no cache can paper over a difference
      expect(render(sample(), frame)).toBe(render(sample(), frame));
    }
  });

  it('a different seed gives a different frame', () => {
    expect(render(sample({ seed: 1 }), 150)).not.toBe(render(sample({ seed: 2 }), 150));
  });

  it('holds each shot: frames within one stop-motion step are identical', () => {
    const slide = sample({ stopMotionFps: 6 }); // 5 frames per shot
    const h = render(slide, 100);
    for (const f of [101, 102, 103, 104]) expect(render(slide, f)).toBe(h);
    expect(render(slide, 105)).not.toBe(h); // new shot → new jitter
  });

  it('at 30 fps every frame is a new shot', () => {
    const slide = sample({ stopMotionFps: 30 });
    expect(render(slide, 170)).not.toBe(render(slide, 171));
  });
});

describe('layout', () => {
  it('keeps every resting element inside the safe margin, for any seed', () => {
    const { ctx } = frameCanvas();
    for (let seed = 0; seed < 40; seed++) {
      for (const fit of ['fit', 'fill'] as const) {
        const slide = sample({ seed, fit });
        for (const el of getLayout(ctx, slide).elements) {
          const { cx, cy, w, h, rot } = el.place;
          const hx = (w * Math.abs(Math.cos(rot)) + h * Math.abs(Math.sin(rot))) / 2;
          const hy = (w * Math.abs(Math.sin(rot)) + h * Math.abs(Math.cos(rot))) / 2;
          // + 2 px of jitter must still clear the margin
          expect(cx - hx - 2).toBeGreaterThanOrEqual(SAFE_MARGIN);
          expect(cy - hy - 2).toBeGreaterThanOrEqual(SAFE_MARGIN);
          expect(cx + hx + 2).toBeLessThanOrEqual(WIDTH - SAFE_MARGIN);
          expect(cy + hy + 2).toBeLessThanOrEqual(HEIGHT - SAFE_MARGIN);
        }
      }
    }
  });

  it('fit mode never crops a screenshot', () => {
    const { ctx } = frameCanvas();
    for (const el of getLayout(ctx, sample()).elements) {
      if (el.kind === 'image') expect(el.src).toEqual({ x: 0, y: 0, w: 1200, h: 630 });
    }
  });
});
