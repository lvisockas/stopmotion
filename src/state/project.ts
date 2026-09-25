import { randomSeed, type Slide, type SlideImage } from '../render';
import { createSlide, MAX_SLIDES, newId, sanitizeSlide } from '../model/slide';

export interface Project {
  slides: Slide[];
  selectedId: string;
}

export type Action =
  | { type: 'load'; project: Project }
  | { type: 'new' }
  | { type: 'select'; id: string }
  | { type: 'add' }
  | { type: 'duplicate'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'moveSlide'; from: number; to: number }
  | { type: 'update'; id: string; patch: Partial<Slide> }
  | { type: 'reshuffle'; id: string }
  | { type: 'addImages'; id: string; images: SlideImage[] }
  | { type: 'removeImage'; id: string; imageId: string }
  | { type: 'moveImage'; id: string; from: number; to: number };

export function freshProject(): Project {
  const slide = createSlide();
  return { slides: [slide], selectedId: slide.id };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

function mapSlide(p: Project, id: string, fn: (s: Slide) => Slide): Project {
  return { ...p, slides: p.slides.map((s) => (s.id === id ? fn(s) : s)) };
}

/** Slides are replaced, never mutated (drawFrame caches layouts per slide object). */
export function reducer(p: Project, a: Action): Project {
  switch (a.type) {
    case 'load':
      return a.project;
    case 'new':
      return freshProject();
    case 'select':
      return { ...p, selectedId: a.id };
    case 'add': {
      if (p.slides.length >= MAX_SLIDES) return p;
      // new slides inherit the look of the current one
      const current = p.slides.find((s) => s.id === p.selectedId);
      const slide = createSlide(
        current
          ? {
              duration: current.duration,
              stopMotionFps: current.stopMotionFps,
              background: current.background,
              textColor: current.textColor,
              textStyle: current.textStyle,
              fit: current.fit,
              cutoutBorder: current.cutoutBorder,
              effects: { ...current.effects },
              // same characters across the carousel, new things to say
              cast: current.cast.map((c) => ({ ...c })),
            }
          : {},
      );
      return { slides: [...p.slides, slide], selectedId: slide.id };
    }
    case 'duplicate': {
      if (p.slides.length >= MAX_SLIDES) return p;
      const i = p.slides.findIndex((s) => s.id === a.id);
      if (i < 0) return p;
      const copy = { ...p.slides[i], id: newId('slide'), images: p.slides[i].images.slice(), effects: { ...p.slides[i].effects } };
      const slides = p.slides.slice();
      slides.splice(i + 1, 0, copy);
      return { slides, selectedId: copy.id };
    }
    case 'delete': {
      if (p.slides.length <= 1) return freshProjectKeepingNothing(p);
      const i = p.slides.findIndex((s) => s.id === a.id);
      const slides = p.slides.filter((s) => s.id !== a.id);
      const selectedId = p.selectedId === a.id ? slides[Math.min(i, slides.length - 1)].id : p.selectedId;
      return { slides, selectedId };
    }
    case 'moveSlide':
      return { ...p, slides: move(p.slides, a.from, a.to) };
    case 'update':
      return mapSlide(p, a.id, (s) => sanitizeSlide({ ...s, ...a.patch, effects: { ...s.effects, ...(a.patch.effects ?? {}) } }));
    case 'reshuffle':
      return mapSlide(p, a.id, (s) => ({ ...s, seed: randomSeed() }));
    case 'addImages':
      return mapSlide(p, a.id, (s) => ({ ...s, images: [...s.images, ...a.images] }));
    case 'removeImage':
      return mapSlide(p, a.id, (s) => ({ ...s, images: s.images.filter((im) => im.id !== a.imageId) }));
    case 'moveImage':
      return mapSlide(p, a.id, (s) => ({ ...s, images: move(s.images, a.from, a.to) }));
  }
}

/** Deleting the only slide leaves one blank slide rather than an empty project. */
function freshProjectKeepingNothing(p: Project): Project {
  const blank = createSlide({ ...p.slides[0], id: newId('slide'), images: [], title: '', subtitle: '' });
  return { slides: [blank], selectedId: blank.id };
}

export function referencedImageIds(p: Project): Set<string> {
  return new Set(p.slides.flatMap((s) => s.images.map((im) => im.id)));
}
