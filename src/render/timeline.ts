import { FPS, MIN_HOLD_SECONDS, type Line, type Slide, type StopMotionRate } from './types';

/** Seconds of empty table before the first element drops in. */
const LEAD_IN = 0.25;
/** A single drop (fall + settle) never takes longer than this. */
const MAX_DROP = 0.7;
/** Gap between consecutive drops never exceeds this. */
const MAX_STAGGER = 0.8;

export function totalFrames(slide: Pick<Slide, 'duration'>): number {
  return Math.round(slide.duration * FPS);
}

/**
 * Stop-motion sampling. The video is always 30 fps, but the scene is only
 * "shot" `rate` times per second; every frame between shots repeats the
 * previous one. Returns the shot index and the scene time it depicts.
 * Rates that don't divide 30 (8, 12) produce the uneven 3/4-frame holds a
 * real animator shooting to a 30p timeline would get.
 */
export function sampleStep(frameIndex: number, rate: StopMotionRate): { step: number; time: number } {
  const step = Math.floor((frameIndex * rate) / FPS + 1e-9);
  return { step, time: step / rate };
}

export interface DropTiming {
  start: number;
  duration: number;
}

/**
 * When each element (in drop order) starts falling, and how long its fall +
 * settle takes. The last element always lands at least MIN_HOLD_SECONDS
 * before the end, so the finished composition holds.
 */
export function dropSchedule(count: number, slideDuration: number): DropTiming[] {
  return dropsWithin(count, Math.max(0.3, slideDuration - LEAD_IN - MIN_HOLD_SECONDS));
}

/** `count` drops, starting at LEAD_IN, all landed within `available` seconds. */
function dropsWithin(count: number, available: number): DropTiming[] {
  if (count === 0) return [];
  const drop = Math.min(MAX_DROP, count === 1 ? available : available * 0.5);
  const stagger = count === 1 ? 0 : Math.min(MAX_STAGGER, (available - drop) / (count - 1));
  return Array.from({ length: count }, (_, i) => ({ start: LEAD_IN + i * stagger, duration: drop }));
}

export interface LineTiming {
  /** Bubble appears. */
  start: number;
  /** Last character typed; the speaker stops talking. */
  typed: number;
}

export interface SceneSchedule {
  drops: DropTiming[];
  lines: LineTiming[];
}

/** Typing speed for bubbles, characters per second (compressed when the slide is short). */
const TYPE_RATE = 20;
const LINE_PAUSE = 0.6;

/**
 * Drops first, then the dialogue, one bubble after another. With no lines
 * this is exactly dropSchedule. The last line is fully typed at least
 * MIN_HOLD_SECONDS before the end.
 */
export function sceneSchedule(count: number, lines: Line[], slideDuration: number): SceneSchedule {
  if (lines.length === 0) return { drops: dropSchedule(count, slideDuration), lines: [] };
  const available = Math.max(0.3, slideDuration - LEAD_IN - MIN_HOLD_SECONDS);
  const dropWindow = count === 0 ? 0 : Math.min(available * 0.4, 0.7 + (count - 1) * 0.55);
  const drops = dropsWithin(count, Math.max(0.3, dropWindow));
  const linesStart = LEAD_IN + dropWindow + 0.2;
  const window = Math.max(0.2, slideDuration - MIN_HOLD_SECONDS - linesStart);
  const typing = lines.map((l) => Math.max(0.5, l.text.trim().length / TYPE_RATE));
  const needed = typing.reduce((a, b) => a + b, 0) + LINE_PAUSE * (lines.length - 1);
  const k = Math.min(1, window / needed);
  let t = linesStart;
  const timings = typing.map((d) => {
    const timing = { start: t, typed: t + d * k };
    t = timing.typed + LINE_PAUSE * k;
    return timing;
  });
  return { drops, lines: timings };
}

/** Scene time at which everything has landed and been said. */
export function sceneEndTime(count: number, lines: Line[], slideDuration: number): number {
  const s = sceneSchedule(count, lines, slideDuration);
  const drops = s.drops.map((d) => d.start + d.duration);
  return Math.max(0, ...drops, ...s.lines.map((l) => l.typed));
}

/** Scene time at which the last element has settled. */
export function lastLandingTime(count: number, slideDuration: number): number {
  const s = dropSchedule(count, slideDuration);
  return s.length ? s[s.length - 1].start + s[s.length - 1].duration : 0;
}
