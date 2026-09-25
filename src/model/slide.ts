import { MAX_CAST, MAX_DURATION, MIN_DURATION, randomSeed, STOP_MOTION_RATES, type Slide, type StopMotionRate } from '../render';

let counter = 0;
export function newId(prefix = 's'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createSlide(partial: Partial<Slide> = {}): Slide {
  return {
    id: newId('slide'),
    seed: randomSeed(),
    duration: 6,
    stopMotionFps: 12,
    images: [],
    title: '',
    subtitle: '',
    textColor: '#1d1a16',
    textStyle: 'label',
    background: '#efe7d8',
    fit: 'fit',
    cutoutBorder: true,
    effects: { paper: true, grain: true, vignette: true, flicker: false },
    cast: [],
    lines: [],
    ...partial,
  };
}

/** Coerces possibly stale / hand-edited stored data back into a valid Slide. */
export function sanitizeSlide(raw: Partial<Slide>): Slide {
  const base = createSlide();
  const s = { ...base, ...raw, effects: { ...base.effects, ...(raw.effects ?? {}) } };
  s.duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(s.duration) || 6));
  if (!STOP_MOTION_RATES.includes(s.stopMotionFps as StopMotionRate)) s.stopMotionFps = 12;
  s.seed = s.seed >>> 0;
  s.images = Array.isArray(s.images) ? s.images.slice(0, 20) : [];
  s.cast = Array.isArray(s.cast) ? s.cast.slice(0, MAX_CAST).map((c) => ({ seed: c.seed >>> 0, name: String(c.name ?? '') })) : [];
  s.lines = Array.isArray(s.lines)
    ? s.lines.map((l) => ({ speaker: Math.max(0, Math.floor(Number(l.speaker) || 0)), text: String(l.text ?? '') }))
    : [];
  return s;
}

export const MAX_SLIDES = 10;
