/**
 * RGBA → I420 (planar 4:2:0), BT.709 matrix, limited ("TV") range.
 *
 * Handing the encoder canvas pixels directly makes Chrome tag the stream
 * full-range sRGB (ffprobe: yuvj420p), which some players and Instagram's
 * ingest treat inconsistently. Converting ourselves pins the output to
 * plain yuv420p / bt709, the most boring and compatible choice.
 *
 * Fixed-point coefficients (×2^16), limited range: Y 16..235, C 16..240.
 */
const SHIFT = 16;
const HALF = 1 << (SHIFT - 1);
const f = (x: number) => Math.round(x * (1 << SHIFT));

const YR = f((0.2126 * 219) / 255);
const YG = f((0.7152 * 219) / 255);
const YB = f((0.0722 * 219) / 255);
const UR = f((-0.114572 * 224) / 255);
const UG = f((-0.385428 * 224) / 255);
const UB = f((0.5 * 224) / 255);
const VR = f((0.5 * 224) / 255);
const VG = f((-0.454153 * 224) / 255);
const VB = f((-0.045847 * 224) / 255);

export const I420_COLOR_SPACE: VideoColorSpaceInit = {
  primaries: 'bt709',
  transfer: 'bt709',
  matrix: 'bt709',
  fullRange: false,
};

export const i420Size = (width: number, height: number) => width * height + 2 * (width / 2) * (height / 2);

/** width and height must be even. `out` must hold i420Size(width, height) bytes. */
export function rgbaToI420(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, out: Uint8Array): Uint8Array {
  const cw = width >> 1;
  const uOff = width * height;
  const vOff = uOff + cw * (height >> 1);
  for (let y = 0; y < height; y++) {
    let p = y * width * 4;
    let o = y * width;
    for (let x = 0; x < width; x++, p += 4, o++) {
      out[o] = (YR * rgba[p] + YG * rgba[p + 1] + YB * rgba[p + 2] + HALF + (16 << SHIFT)) >> SHIFT;
    }
  }
  for (let cy = 0; cy < height >> 1; cy++) {
    const row0 = cy * 2 * width * 4;
    const row1 = row0 + width * 4;
    let o = cy * cw;
    for (let cx = 0; cx < cw; cx++, o++) {
      const a = row0 + cx * 8;
      const b = row1 + cx * 8;
      // 2×2 box average (sum of 4, divided in the final shift)
      const r = rgba[a] + rgba[a + 4] + rgba[b] + rgba[b + 4];
      const g = rgba[a + 1] + rgba[a + 5] + rgba[b + 1] + rgba[b + 5];
      const bl = rgba[a + 2] + rgba[a + 6] + rgba[b + 2] + rgba[b + 6];
      out[uOff + o] = (UR * r + UG * g + UB * bl + (HALF << 2) + (128 << (SHIFT + 2))) >> (SHIFT + 2);
      out[vOff + o] = (VR * r + VG * g + VB * bl + (HALF << 2) + (128 << (SHIFT + 2))) >> (SHIFT + 2);
    }
  }
  return out;
}
