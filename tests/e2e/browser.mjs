// Shared by the e2e scripts: a Vite dev server plus a headless Chrome.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

// H.264 encoding needs proprietary codecs: Chrome / Chrome for Testing, not
// Playwright's open-source Chromium. First existing path wins.
const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  `${root}.chrome/chrome-headless-shell-linux64/chrome-headless-shell`,
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium',
].filter(Boolean);

export async function startEnv() {
  const server = await createServer({ root, server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  const browser = await chromium.launch({ executablePath, headless: true });
  return {
    url,
    browser,
    executablePath,
    async close() {
      await browser.close();
      await server.close();
    },
  };
}
