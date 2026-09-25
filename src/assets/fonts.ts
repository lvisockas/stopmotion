import '@fontsource/inter/500.css';
import '@fontsource/inter/800.css';
import { FONT_FAMILY } from '../render';

/** Includes Lithuanian letters so the latin-ext subset is fetched, not just latin. */
const SAMPLE = 'Aa ĄąČčĘęĖėĮįŠšŲųŪūŽž „“';

let ready: Promise<void> | null = null;

/**
 * Canvas text never triggers a webfont load by itself, and @fontsource
 * splits the font into unicode-range subsets, so each weight is loaded
 * explicitly with a sample that covers every subset we need.
 */
export function loadFonts(): Promise<void> {
  ready ??= (async () => {
    await Promise.all([500, 800].map((w) => document.fonts.load(`${w} 40px ${FONT_FAMILY}`, SAMPLE)));
    await document.fonts.ready;
  })();
  return ready;
}
