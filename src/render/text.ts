import type { Ctx2D } from './types';

export const FONT_FAMILY = 'Inter';

export interface TextSpec {
  weight: number;
  maxSize: number;
  minSize: number;
  maxLines: number;
  lineHeight: number;
}

export const TITLE_SPEC: TextSpec = { weight: 800, maxSize: 76, minSize: 40, maxLines: 3, lineHeight: 1.12 };
export const SUBTITLE_SPEC: TextSpec = { weight: 500, maxSize: 42, minSize: 26, maxLines: 4, lineHeight: 1.3 };

export interface TextBlock {
  lines: string[];
  font: string;
  size: number;
  lineHeight: number;
  /** Widest line, px. */
  width: number;
  height: number;
}

export const fontString = (weight: number, size: number) => `${weight} ${size}px ${FONT_FAMILY}, sans-serif`;

/** Splits a word that alone is wider than maxWidth into pieces that fit. */
function breakWord(ctx: Ctx2D, word: string, maxWidth: number): string[] {
  const parts: string[] = [];
  let current = '';
  for (const ch of Array.from(word)) {
    if (current && ctx.measureText(current + ch).width > maxWidth) {
      parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Greedy word wrap. Respects explicit newlines. Uses the ctx's current font. */
export function wrapLines(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const pieces = ctx.measureText(word).width > maxWidth ? breakWord(ctx, word, maxWidth) : [word];
      for (const piece of pieces) {
        const candidate = line ? `${line} ${piece}` : piece;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = piece;
        } else {
          line = candidate;
        }
      }
    }
    lines.push(line);
  }
  // trailing blank lines add nothing but height
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Picks the largest size (stepping down 2px at a time) at which the text
 * fits in maxLines. At the minimum size, overflowing lines are dropped and
 * the last kept line gets an ellipsis, so text never leaves its box.
 */
export function layoutText(ctx: Ctx2D, text: string, maxWidth: number, spec: TextSpec): TextBlock | null {
  if (!text.trim()) return null;
  let size = spec.maxSize;
  let lines: string[] = [];
  for (; size >= spec.minSize; size -= 2) {
    ctx.font = fontString(spec.weight, size);
    lines = wrapLines(ctx, text.trim(), maxWidth);
    if (lines.length <= spec.maxLines) break;
  }
  if (size < spec.minSize) {
    size = spec.minSize;
    ctx.font = fontString(spec.weight, size);
    lines = wrapLines(ctx, text.trim(), maxWidth).slice(0, spec.maxLines);
    let last = lines[lines.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const lineHeight = Math.round(size * spec.lineHeight);
  return { lines, font: ctx.font, size, lineHeight, width, height: lines.length * lineHeight };
}
