import { describe, expect, it } from 'vitest';
import { createSlide } from '../../src/model/slide';
import { drawFrame, getLayout, HEIGHT, MIN_HOLD_SECONDS, SAFE_MARGIN, WIDTH, type Slide } from '../../src/render';
import { sceneEndTime, sceneSchedule } from '../../src/render/timeline';
import { fakeScreenshot, frameCanvas, hashCanvas } from './setup';

const shot = fakeScreenshot(0);
const assets = () => shot;

function comic(overrides: Partial<Slide> = {}): Slide {
  return createSlide({
    id: 'comic',
    seed: 7,
    subtitle: 'TechCrunch · September 25, 2026',
    images: [{ id: 'img0', name: '0.png', width: 1200, height: 630 }],
    cast: [
      { seed: 11, name: 'Rita' },
      { seed: 22, name: 'Moe' },
    ],
    lines: [
      { speaker: 0, text: 'The Pentagon wants a $30 million AI lie detector.' },
      { speaker: 1, text: 'Cool. Totally cool. I love that.' },
      { speaker: 0, text: '…It just beeped.' },
    ],
    duration: 9,
    ...overrides,
  });
}

const render = (slide: Slide, frame: number) => {
  const { canvas, ctx } = frameCanvas();
  drawFrame(ctx, slide, frame, assets);
  return hashCanvas(canvas);
};

describe('comic layer', () => {
  it('is deterministic', () => {
    for (const f of [40, 120, 200, 269]) expect(render(comic(), f)).toBe(render(comic(), f));
  });

  it('types bubbles: text changes while a line is being said, then holds', () => {
    const slide = comic({ stopMotionFps: 30, effects: { paper: false, grain: false, vignette: false, flicker: false } });
    const s = sceneSchedule(getLayout(frameCanvas().ctx, slide).elements.length, slide.lines, slide.duration);
    const mid = Math.floor(((s.lines[0].start + s.lines[0].typed) / 2) * 30);
    expect(render(slide, mid)).not.toBe(render(slide, mid + 3));
  });

  it('finishes the last line at least 1.5 s before the end, for any duration', () => {
    for (let d = 3; d <= 15; d += 0.5) {
      const slide = comic({ duration: d });
      const n = getLayout(frameCanvas().ctx, slide).elements.length;
      expect(sceneEndTime(n, slide.lines, d)).toBeLessThanOrEqual(d - MIN_HOLD_SECONDS + 1e-9);
      const s = sceneSchedule(n, slide.lines, d);
      for (let i = 1; i < s.lines.length; i++) expect(s.lines[i].start).toBeGreaterThanOrEqual(s.lines[i - 1].typed);
    }
  });

  it('keeps characters and bubbles inside the safe margin', () => {
    const { ctx } = frameCanvas();
    for (let seed = 0; seed < 20; seed++) {
      for (const n of [1, 2, 3]) {
        const slide = comic({ seed, cast: [1, 2, 3].slice(0, n).map((k) => ({ seed: k * seed, name: '' })) });
        const layout = getLayout(ctx, slide);
        for (const el of layout.elements.filter((e) => e.kind === 'character')) {
          expect(el.place.cy + el.place.h / 2).toBeLessThanOrEqual(HEIGHT - SAFE_MARGIN);
          expect(el.place.cx - el.place.w / 2).toBeGreaterThanOrEqual(SAFE_MARGIN - 8);
        }
        for (const b of layout.bubbles) {
          if (!b) continue;
          expect(b.x).toBeGreaterThanOrEqual(SAFE_MARGIN);
          expect(b.x + b.w).toBeLessThanOrEqual(WIDTH - SAFE_MARGIN);
        }
      }
    }
  });

  it('ignores lines whose speaker is not in the cast', () => {
    const slide = comic({ lines: [{ speaker: 5, text: 'Nobody says this' }] });
    expect(getLayout(frameCanvas().ctx, slide).bubbles).toEqual([null]);
    expect(() => render(slide, 200)).not.toThrow();
  });
});
