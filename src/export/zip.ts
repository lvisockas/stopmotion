import { zipSync } from 'fflate';

/** 01.mp4, 02.mp4, … in carousel order. */
export const slideFileName = (index: number) => `${String(index + 1).padStart(2, '0')}.mp4`;

/** MP4 is already compressed; store (level 0) keeps zipping instant. */
export function zipVideos(videos: Uint8Array[]): Uint8Array {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  videos.forEach((v, i) => (files[slideFileName(i)] = [v, { level: 0 }]));
  return zipSync(files);
}

export function downloadBytes(bytes: Uint8Array, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
