import { sanitizeSlide } from '../model/slide';
import { decodeBlob, forgetImage } from '../assets/images';
import { pendingImports } from '../assets/import';
import { allBlobIds, clearBlobs, deleteBlob, getBlob } from './idb';
import { freshProject, referencedImageIds, type Project } from './project';

const KEY = 'stopmotion-carousel.project.v1';

/** Slide settings go to localStorage; image bytes live in IndexedDB (localStorage is ~5 MB). */
export function saveProject(p: Project): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, ...p }));
  } catch (e) {
    console.warn('Could not save project', e);
  }
}

/** Loads the saved project and decodes every image it references. Missing blobs are dropped. */
export const hasSavedProject = () => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
};

export async function loadProject(): Promise<Project> {
  let project = freshProject();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Project>;
      const slides = (parsed.slides ?? []).map(sanitizeSlide).slice(0, 10);
      if (slides.length) {
        const selectedId = slides.some((s) => s.id === parsed.selectedId) ? parsed.selectedId! : slides[0].id;
        project = { slides, selectedId };
      }
    }
  } catch (e) {
    console.warn('Saved project unreadable, starting fresh', e);
  }
  const missing = new Set<string>();
  await Promise.all(
    [...referencedImageIds(project)].map(async (id) => {
      try {
        const blob = await getBlob(id);
        if (blob) await decodeBlob(id, blob);
        else missing.add(id);
      } catch {
        missing.add(id);
      }
    }),
  );
  if (missing.size) {
    project = {
      ...project,
      slides: project.slides.map((s) => ({ ...s, images: s.images.filter((im) => !missing.has(im.id)) })),
    };
  }
  return project;
}

/** Deletes stored images no slide references any more. */
export async function collectGarbage(p: Project): Promise<void> {
  const keep = referencedImageIds(p);
  for (const id of await allBlobIds()) {
    if (!keep.has(id) && !pendingImports.has(id)) {
      await deleteBlob(id);
      forgetImage(id);
    }
  }
}

export async function resetStorage(): Promise<void> {
  localStorage.removeItem(KEY);
  await clearBlobs();
}
