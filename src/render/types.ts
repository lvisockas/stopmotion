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

export type FitMode = 'fit' | 'fill';
export type TextStyle = 'plain' | 'label';

export interface SlideImage {
  /** Key into the asset store (IndexedDB) and the decoded-image lookup. */
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface Effects {
  /** Paper texture on the background (otherwise a solid color). */
  paper: boolean;
  grain: boolean;
  vignette: boolean;
  flicker: boolean;
}

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
}

/** Anything drawImage accepts and that has intrinsic dimensions. */
export type DrawableImage = CanvasImageSource & { width: number; height: number };

/** Resolves an image id to a fully decoded drawable. Missing ids draw a placeholder. */
export type AssetLookup = (id: string) => DrawableImage | undefined;

/** Both the DOM and OffscreenCanvas contexts work; node-canvas look-alikes are cast to this. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
