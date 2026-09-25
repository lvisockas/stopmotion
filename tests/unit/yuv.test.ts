import { describe, expect, it } from 'vitest';
import { i420Size, rgbaToI420 } from '../../src/export/yuv';

function solid(r: number, g: number, b: number, w = 4, h = 2) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < rgba.length; p += 4) rgba.set([r, g, b, 255], p);
  return rgbaToI420(rgba, w, h, new Uint8Array(i420Size(w, h)));
}

describe('rgbaToI420 (BT.709, limited range)', () => {
  it('maps white and black to 235 / 16 with neutral chroma', () => {
    const white = solid(255, 255, 255);
    const black = solid(0, 0, 0);
    expect([white[0], white[8], white[10]]).toEqual([235, 128, 128]);
    expect([black[0], black[8], black[10]]).toEqual([16, 128, 128]);
  });

  it('matches the BT.709 equations for pure red', () => {
    const red = solid(255, 0, 0);
    expect(red[0]).toBe(Math.round(16 + 219 * 0.2126)); // 63
    expect(red[8]).toBe(Math.round(128 - 224 * 0.114572)); // 102
    expect(red[10]).toBe(240);
  });
});
