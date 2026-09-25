import type { AssetLookup, DrawableImage } from '../render';

const decoded = new Map<string, HTMLImageElement>();
const urls = new Map<string, string>();

/** Loads a blob into an <img> and waits for image.decode(), so the first frame never draws a half-decoded image. */
export async function decodeBlob(id: string, blob: Blob): Promise<HTMLImageElement> {
  const existing = decoded.get(id);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  decoded.set(id, img);
  urls.set(id, url);
  return img;
}

export function forgetImage(id: string): void {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  decoded.delete(id);
}

export const lookupAsset: AssetLookup = (id) => decoded.get(id) as DrawableImage | undefined;

export const isDecoded = (id: string) => decoded.has(id);

/** Object URL of a decoded image, for <img> thumbnails in the editor UI. */
export const imageUrl = (id: string) => urls.get(id);
