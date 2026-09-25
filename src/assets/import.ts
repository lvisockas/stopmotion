import type { SlideImage } from '../render';
import { newId } from '../model/slide';
import { putBlob } from '../state/idb';
import { decodeBlob } from './images';

/** Stored but not yet referenced by a slide: garbage collection must leave these alone. */
export const pendingImports = new Set<string>();

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Stores one image blob in IndexedDB and decodes it. Call settleImports once it is in the project. */
export async function importImageBlob(blob: Blob, name: string): Promise<SlideImage> {
  const id = newId('img');
  pendingImports.add(id);
  try {
    const img = await decodeBlob(id, blob);
    await putBlob(id, blob);
    return { id, name, width: img.naturalWidth, height: img.naturalHeight };
  } catch (e) {
    pendingImports.delete(id);
    throw e;
  }
}

/** Stores each file in IndexedDB and decodes it. Non-images are skipped, in order. */
export async function importImageFiles(files: Iterable<File>): Promise<SlideImage[]> {
  const out: SlideImage[] = [];
  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) continue;
    try {
      out.push(await importImageBlob(file, file.name));
    } catch (e) {
      console.warn(`Could not read ${file.name}`, e);
    }
  }
  return out;
}

/** Call once the imported images are in the project. */
export function settleImports(images: SlideImage[]): void {
  for (const im of images) pendingImports.delete(im.id);
}
