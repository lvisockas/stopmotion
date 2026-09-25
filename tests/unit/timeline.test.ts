import { describe, expect, it } from 'vitest';
import { dropSchedule, lastLandingTime, MIN_HOLD_SECONDS, sampleStep, STOP_MOTION_RATES } from '../../src/render';
import { hashInts, mulberry32 } from '../../src/render/prng';
import { wrapLines } from '../../src/render/text';
import { frameCanvas } from './setup';

describe('timeline', () => {
  it('always holds the final composition for at least 1.5 s', () => {
    for (let duration = 3; duration <= 15; duration += 0.5) {
      for (let count = 1; count <= 13; count++) {
        expect(lastLandingTime(count, duration)).toBeLessThanOrEqual(duration - MIN_HOLD_SECONDS + 1e-9);
      }
    }
  });

  it('drops start in order', () => {
    const s = dropSchedule(5, 6);
    for (let i = 1; i < s.length; i++) expect(s[i].start).toBeGreaterThan(s[i - 1].start);
  });

  it('samples a new shot `rate` times per second', () => {
    for (const rate of STOP_MOTION_RATES) {
      const steps = new Set(Array.from({ length: 30 }, (_, f) => sampleStep(f, rate).step));
      expect(steps.size).toBe(rate);
    }
  });
});

describe('prng', () => {
  it('is reproducible and key-sensitive', () => {
    const a = mulberry32(hashInts(7, 3, 1));
    const b = mulberry32(hashInts(7, 3, 1));
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect(mulberry32(hashInts(7, 3, 2))()).not.toBe(seqA[0]);
    for (const v of seqA) expect(v >= 0 && v < 1).toBe(true);
  });
});

describe('text wrap', () => {
  it('wraps Lithuanian text without losing characters', () => {
    const { ctx } = frameCanvas();
    ctx.font = '800 60px Inter';
    const text = 'Ąžuolas čiulbėjo įspūdingai šalia ūkininkų žemės, ęė ų';
    const lines = wrapLines(ctx, text, 400);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(text);
    for (const l of lines) expect(ctx.measureText(l).width).toBeLessThanOrEqual(400);
  });
});
