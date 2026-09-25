import type { SlideImage } from '../render';
import { newId } from '../model/slide';
import { putBlob } from '../state/idb';
import { decodeBlob } from './images';

/** Stored but not yet referenced by a slide: garbage collection must leave these alone. */
export const pendingImports = new Set<string>();

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Stores each file in IndexedDB and decodes it. Non-images are skipped, in order. */
export async function importImageFiles(files: Iterable<File>): Promise<SlideImage[]> {
  const out: SlideImage[] = [];
  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) continue;
    const id = newId('img');
    pendingImports.add(id);
    try {
      const img = await decodeBlob(id, file);
      await putBlob(id, file);
      out.push({ id, name: file.name, width: img.naturalWidth, height: img.naturalHeight });
    } catch (e) {
      pendingImports.delete(id);
      console.warn(`Could not read ${file.name}`, e);
    }
  }
  return out;
}

/** Call once the imported images are in the project. */
export function settleImports(images: SlideImage[]): void {
  for (const im of images) pendingImports.delete(im.id);
}
