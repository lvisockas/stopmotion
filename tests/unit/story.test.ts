import { describe, expect, it } from 'vitest';
import { familyTripDemo } from '../../src/demos/familyTrip';
import { createSlide } from '../../src/model/slide';
import { drawFrame, MIN_HOLD_SECONDS, SCENES, type Slide } from '../../src/render';
import { getLayout } from '../../src/render';
import { sceneEndTime } from '../../src/render/timeline';
import { frameCanvas, hashCanvas } from './setup';

const render = (slide: Slide, frame: number) => {
  const { canvas, ctx } = frameCanvas();
  drawFrame(ctx, slide, frame, () => undefined);
  return hashCanvas(canvas);
};

const family = familyTripDemo().slides;

describe('story slides', () => {
  it('every backdrop renders deterministically', () => {
    for (const scene of SCENES) {
      const s = createSlide({ id: 'x', seed: 3, scene });
      expect(render(s, 20)).toBe(render({ ...s }, 20));
    }
  });

  it('a settled slide shows its characters from frame 0; a tossed one does not', () => {
    const base = family[1];
    const empty = { ...base, cast: [], lines: [], props: [], title: '' };
    const settled = { ...base, lines: [], props: [], title: '' };
    const tossed = { ...settled, intro: 'drop' as const };
    // same seed and step, so the only difference can be the characters
    expect(render(settled, 0)).not.toBe(render(empty, 0));
    expect(render(tossed, 0)).toBe(render(empty, 0));
  });

  it('only the first family slide tosses everything in', () => {
    expect(family.map((s) => s.intro)).toEqual(['drop', ...Array(family.length - 1).fill('settled')]);
  });

  it('"still" props are in place from frame 0', () => {
    const birthday = family.find((s) => s.props.some((p) => p.still))!;
    const withTable = { ...birthday, props: birthday.props.filter((p) => p.still), lines: [] };
    const without = { ...withTable, props: [] };
    expect(render(withTable, 0)).not.toBe(render(without, 0));
  });

  it('every family slide finishes its dialogue with the 1.5 s hold', () => {
    const { ctx } = frameCanvas();
    for (const s of family) {
      const dropping = getLayout(ctx, s).elements.filter((e) => (e.kind === 'prop' ? !e.prop.still : s.intro !== 'settled'));
      expect(sceneEndTime(dropping.length, s.lines, s.duration)).toBeLessThanOrEqual(s.duration - MIN_HOLD_SECONDS + 1e-9);
    }
  });

  it('keeps the trip plan private: no names, codes or addresses in the demo', () => {
    const text = JSON.stringify(family);
    for (const secret of ['Lukas', 'Indrė', 'Jonuk', '3007', 'Alliit', 'Mathildevej', 'D-2026']) {
      expect(text).not.toContain(secret);
    }
  });
});
