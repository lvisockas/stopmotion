import { importImageBlob, settleImports } from './assets/import';
import { createSlide } from './model/slide';
import type { CastMember, Line, Slide, SlideImage } from './render';
import type { Project } from './state/project';

/** Shape of public/demo/news.json, written by scripts/scrape-news.mjs. */
interface NewsManifest {
  generated: string;
  headlines: { publisher: string; title: string; url: string; published: string; file: string }[];
}

/** public/demo/dialogue.json: who's in the comic and what they say about each headline (by URL). */
interface Dialogue {
  cast: CastMember[];
  cover: [number, string][];
  fallback: [number, string][];
  headlines: Record<string, [number, string][]>;
}

const MANIFEST = './demo/news.json';
const DIALOGUE = './demo/dialogue.json';
const toLines = (pairs: [number, string][]): Line[] => pairs.map(([speaker, text]) => ({ speaker, text }));
const COVER_IMAGES = 3;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/**
 * The default project: a cover slide with the first three headline
 * screenshots, then one slide per headline credited to its publisher, with
 * two cutout characters talking about each one in speech bubbles.
 * Returns null when the demo files are missing, so the caller can fall
 * back to a blank project.
 */
export async function loadNewsDemo(): Promise<Project | null> {
  const res = await fetch(MANIFEST);
  if (!res.ok) return null;
  const manifest = (await res.json()) as NewsManifest;
  const dialogue = (await fetch(DIALOGUE)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)) as Dialogue | null;
  const cast = dialogue?.cast ?? [];
  const talk = (pairs: [number, string][] | undefined): Partial<Slide> =>
    cast.length && pairs ? { cast: cast.map((c) => ({ ...c })), lines: toLines(pairs) } : {};
  const loaded: { image: SlideImage; item: NewsManifest['headlines'][number] }[] = [];
  for (const item of manifest.headlines.slice(0, 9)) {
    try {
      const blob = await (await fetch(`./demo/${item.file}`)).blob();
      loaded.push({ image: await importImageBlob(blob, `${item.publisher}.jpg`), item });
    } catch (e) {
      console.warn(`Demo image ${item.file} failed`, e);
    }
  }
  if (loaded.length === 0) return null;

  const cover = createSlide({
    title: 'This week in AI',
    subtitle: `${day(manifest.generated)} · ${loaded.length} headlines`,
    images: loaded.slice(0, COVER_IMAGES).map((l) => l.image),
    duration: 8,
    ...talk(dialogue?.cover),
  });
  const singles: Slide[] = loaded.map(({ image, item }) =>
    createSlide({
      images: [image],
      subtitle: `${item.publisher} · ${day(item.published)}`,
      duration: 9,
      ...talk(dialogue ? (dialogue.headlines[item.url] ?? dialogue.fallback) : undefined),
    }),
  );
  settleImports(loaded.map((l) => l.image));
  return { slides: [cover, ...singles], selectedId: cover.id };
}
