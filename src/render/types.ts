/** Output frame geometry. Fixed by the Instagram 4:5 carousel spec. */
export const WIDTH = 1080;
export const HEIGHT = 1350;
export const FPS = 30;
/** Nothing at rest may come closer than this to the frame edge. */
export const SAFE_MARGIN = 60;
/** The final composition holds at least this long after the last element lands. */
export const MIN_HOLD_SECONDS = 1.5;
export const MIN_DURATION = 3;
export const MAX_DURATION = 15;

export const STOP_MOTION_RATES = [6, 8, 12, 15, 30] as const;
export type StopMotionRate = (typeof STOP_MOTION_RATES)[number];

export type FitMode = 'fit' | 'fill' | 'cutout';
export type TextStyle = 'plain' | 'label';

export interface SlideImage {
  /** Key into the asset store (IndexedDB) and the decoded-image lookup. */
  id: string;
  name: string;
  width: number;
  height: number;
  /**
   * Cutout mode only: where it stands. x = centre, y = bottom edge (feet),
   * h = height, all as fractions of the frame. May bleed off the frame.
   */
  place?: { x: number; y: number; h: number };
}

export interface Effects {
  /** Paper texture on the background (otherwise a solid color). */
  paper: boolean;
  grain: boolean;
  vignette: boolean;
  flicker: boolean;
}

/** Explicit look choices; anything left out comes from the seed. */
export interface LookOverrides {
  skin?: string;
  coat?: string;
  hat?: string;
  hair?: string;
  mitten?: string;
  style?: 'beanie' | 'striped' | 'cap' | 'spiky' | 'bob';
  beard?: boolean;
  longHair?: boolean;
}

/** A paper-cutout character. Its look derives from `seed`, then `look` overrides. */
export interface CastMember {
  seed: number;
  name: string;
  look?: LookOverrides;
  /** 1 = adult size; a toddler is about 0.68. */
  scale?: number;
  /** Horizontal position as a fraction of the frame width (default: evenly spaced). */
  x?: number;
}

export const SCENES = ['none', 'sky', 'icefjord', 'town', 'mountain-town', 'snowfield', 'aurora', 'room', 'canal', 'shopfront'] as const;
export type SceneKind = (typeof SCENES)[number];

export const PROP_KINDS = [
  'plane', 'boat', 'iceberg', 'suitcase', 'flag', 'dog', 'dog-hut', 'table', 'cake', 'coffee',
  'pumpkin', 'cargo-bike', 'goat', 'clothes-rack', 'shopping-bag', 'snow',
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** A cutout story prop. Positions are fractions of the frame; `back` props sit behind the characters. */
export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  scale: number;
  layer: 'back' | 'front';
  /** Mirror horizontally. */
  flip?: boolean;
  /** Part of the set (furniture): already in place, never drops in. */
  still?: boolean;
}

/** 'drop': everything tosses in. 'settled': scene, text and characters are already there; only props drop. */
export type Intro = 'drop' | 'settled';

/** One speech bubble, said by cast[speaker]. */
export interface Line {
  speaker: number;
  text: string;
}

export const MAX_CAST = 3;

export interface Slide {
  id: string;
  /** uint32; drives layout, rotations, jitter and every effect. */
  seed: number;
  /** Seconds, MIN_DURATION..MAX_DURATION. */
  duration: number;
  stopMotionFps: StopMotionRate;
  images: SlideImage[];
  title: string;
  subtitle: string;
  textColor: string;
  textStyle: TextStyle;
  background: string;
  fit: FitMode;
  /** White paper border around each screenshot, like a cutout. */
  cutoutBorder: boolean;
  effects: Effects;
  /** Comic layer: characters standing at the bottom, talking in bubbles. */
  cast: CastMember[];
  lines: Line[];
  /** Cut-paper backdrop drawn instead of the plain background. */
  scene: SceneKind;
  props: Prop[];
  intro: Intro;
}

/** Anything drawImage accepts and that has intrinsic dimensions. */
export type DrawableImage = CanvasImageSource & { width: number; height: number };

/** Resolves an image id to a fully decoded drawable. Missing ids draw a placeholder. */
export type AssetLookup = (id: string) => DrawableImage | undefined;

/** Both the DOM and OffscreenCanvas contexts work; node-canvas look-alikes are cast to this. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
