import { FPS, MIN_HOLD_SECONDS, type Slide, type StopMotionRate } from './types';

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
  if (count === 0) return [];
  const available = Math.max(0.3, slideDuration - LEAD_IN - MIN_HOLD_SECONDS);
  const drop = Math.min(MAX_DROP, count === 1 ? available : available * 0.5);
  const stagger = count === 1 ? 0 : Math.min(MAX_STAGGER, (available - drop) / (count - 1));
  return Array.from({ length: count }, (_, i) => ({ start: LEAD_IN + i * stagger, duration: drop }));
}

/** Scene time at which the last element has settled. */
export function lastLandingTime(count: number, slideDuration: number): number {
  const s = dropSchedule(count, slideDuration);
  return s.length ? s[s.length - 1].start + s[s.length - 1].duration : 0;
}
