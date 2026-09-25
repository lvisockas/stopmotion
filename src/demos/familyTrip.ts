import { createSlide } from '../model/slide';
import type { CastMember, Line, Prop, SceneKind, Slide } from '../render';
import type { Project } from '../state/project';

/**
 * "Greenland 2026": a family trip told as a cut-paper comic. Dad, Mom and
 * their little boy; dates and places from the trip plan. The first slide
 * tosses everything onto the table; every later slide opens on the settled
 * scene and only the story props drop in.
 */
const FAMILY: CastMember[] = [
  {
    seed: 101,
    name: 'Dad',
    x: 0.2,
    look: { skin: '#f2c7a1', coat: '#2f67b3', hat: '#c8352b', mitten: '#56606b', hair: '#6b3e1f', style: 'beanie', beard: true },
  },
  {
    seed: 202,
    name: 'Mom',
    x: 0.8,
    look: { skin: '#f6d2b1', coat: '#c8352b', hat: '#3e8c4a', mitten: '#e8b52a', hair: '#e0b04a', style: 'striped', longHair: true },
  },
  {
    seed: 303,
    name: 'Boy',
    x: 0.5,
    scale: 0.66,
    look: { skin: '#f6d2b1', coat: '#e8b52a', hat: '#2f67b3', mitten: '#c8352b', hair: '#e0b04a', style: 'beanie' },
  },
];
const DAD = 0;
const MOM = 1;
const BOY = 2;

const prop = (kind: Prop['kind'], x: number, y: number, scale = 1, layer: Prop['layer'] = 'back', flip = false): Prop => ({
  kind,
  x,
  y,
  scale,
  layer,
  flip,
});

interface Beat {
  title: string;
  subtitle?: string;
  scene: SceneKind;
  props: Prop[];
  lines: [number, string][];
  duration?: number;
  /** Per-slide positions for Dad, Mom, Boy (fractions of the width). */
  positions?: [number, number, number];
}

const STORY: Beat[] = [
  {
    title: 'Sep 28 · Vilnius → Copenhagen',
    subtitle: 'Greenland 2026: first time at the edge of the world',
    scene: 'sky',
    props: [prop('plane', 0.52, 0.47, 1), prop('suitcase', 0.36, 0.9, 0.9, 'front')],
    lines: [
      [DAD, 'Twelve days. Three cities.'],
      [MOM, 'And one two-year-old.'],
      [BOY, 'Plane!!'],
    ],
    duration: 10,
  },
  {
    title: 'Sep 29 · Ilulissat, Greenland',
    scene: 'town',
    props: [prop('flag', 0.9, 0.62, 0.8), prop('plane', 0.72, 0.13, 0.35)],
    lines: [
      [BOY, 'Cold!'],
      [MOM, 'Four hours behind home. Nap time is a mystery.'],
      [DAD, 'Here the weather decides. Sila.'],
    ],
  },
  {
    title: 'Sep 30 · Ilulissat Icefjord',
    scene: 'icefjord',
    props: [prop('boat', 0.3, 0.6, 0.85), prop('iceberg', 0.76, 0.58, 1.1)],
    lines: [
      [DAD, 'The one fixed plan: the boat at three.'],
      [BOY, 'Big ice!'],
      [MOM, 'Older than all of us put together.'],
    ],
  },
  {
    title: 'Oct 1 · Sermermiut trail',
    scene: 'snowfield',
    props: [
      prop('dog-hut', 0.13, 0.7, 0.8),
      prop('dog', 0.36, 0.72, 0.75),
      prop('dog', 0.66, 0.71, 0.7, 'back', true),
      prop('snow', 0, 0, 1, 'front'),
    ],
    lines: [
      [BOY, 'Doggy!'],
      [MOM, 'Look, don’t touch.'],
      [DAD, 'They’re working dogs. We wave from the trail.'],
    ],
  },
  {
    title: 'Oct 3 · Mom’s birthday, Ilulissat',
    scene: 'room',
    props: [{ ...prop('table', 0.5, 0.95, 1, 'front'), still: true }, prop('cake', 0.64, 0.81, 0.9, 'front')],
    positions: [0.16, 0.85, 0.4],
    lines: [
      [DAD, 'Table by the window, as ordered.'],
      [BOY, 'Happy birthday, Mama!'],
      [MOM, 'Icebergs for dessert.'],
    ],
  },
  {
    title: 'Oct 3, 23:00 · Aurora hunt',
    scene: 'aurora',
    props: [],
    lines: [
      [DAD, 'Clear sky. The forecast says yes.'],
      [MOM, 'Look up!'],
      [BOY, 'Zzz…'],
    ],
  },
  {
    title: 'Oct 5 · Nuuk',
    scene: 'mountain-town',
    props: [prop('plane', 0.8, 0.16, 0.35, 'back', true), prop('coffee', 0.33, 0.83, 0.8, 'front')],
    lines: [
      [MOM, 'One night in the capital.'],
      [DAD, 'Coffee at Katuaq, a harbour walk, then the plane.'],
      [BOY, 'Plane again!'],
    ],
  },
  {
    title: 'Oct 7 · Copenhagen',
    scene: 'canal',
    props: [
      prop('pumpkin', 0.36, 0.91, 0.75, 'front'),
      prop('pumpkin', 0.64, 0.92, 0.65, 'front'),
      prop('pumpkin', 0.94, 0.9, 0.8, 'front'),
    ],
    lines: [
      [BOY, 'Pumpkins!'],
      [DAD, 'Tivoli Halloween. Carousels cost extra.'],
      [MOM, 'Worth it.'],
    ],
  },
  {
    title: 'Oct 8 · Cargo bike day',
    scene: 'canal',
    // the boy rides in the box: the bike is in front of him
    props: [prop('cargo-bike', 0.6, 0.93, 0.9, 'front'), prop('goat', 0.33, 0.73, 0.8, 'back')],
    positions: [0.15, 0.87, 0.49],
    lines: [
      [DAD, 'Fourteen kilometres. Zero shops. Promise.'],
      [BOY, 'Goat!'],
      [MOM, 'Dinner at Bæst at five.'],
    ],
  },
  {
    title: 'Oct 9 · Home to Vilnius',
    scene: 'sky',
    props: [prop('plane', 0.5, 0.45, 1, 'back', true)],
    lines: [
      [BOY, 'Again!'],
      [MOM, 'Same time next year?'],
      [DAD, 'Sila willing.'],
    ],
  },
];

const toLines = (pairs: [number, string][]): Line[] => pairs.map(([speaker, text]) => ({ speaker, text }));

export function familyTripDemo(): Project {
  const slides: Slide[] = STORY.map((beat, i) =>
    createSlide({
      title: beat.title,
      subtitle: beat.subtitle ?? '',
      scene: beat.scene,
      props: beat.props,
      cast: FAMILY.map((m, k) => ({ ...m, look: { ...m.look }, x: beat.positions?.[k] ?? m.x })),
      lines: toLines(beat.lines),
      intro: i === 0 ? 'drop' : 'settled',
      duration: beat.duration ?? 9,
      stopMotionFps: 12,
      seed: 5000 + i,
      effects: { paper: true, grain: true, vignette: true, flicker: false },
    }),
  );
  return { slides, selectedId: slides[0].id };
}
