// Scrapes recent AI headlines from publisher RSS feeds, opens each article
// in headless Chrome and screenshots the headline block as it appears on
// the publisher's site. Writes public/demo/*.jpg + public/demo/news.json,
// which the app loads as its default (first-visit) project.
//
//   node scripts/scrape-news.mjs            (CHROMIUM_PATH optional)
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const OUT = 'public/demo';
const PER_FEED = 1;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const FEEDS = [
  { publisher: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { publisher: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { publisher: 'MIT Technology Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { publisher: 'Wired', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
  { publisher: 'The Guardian', url: 'https://www.theguardian.com/technology/artificialintelligenceai/rss' },
  { publisher: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
];

const AI_WORDS = /\b(AI|A\.I\.|artificial intelligence|LLM|chatbot|OpenAI|Anthropic|Claude|Gemini|ChatGPT|GPT|DeepMind|machine learning|neural|Copilot|Llama|Mistral)\b/i;

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
};

/** RSS <item> or Atom <entry> → {title, url, published}. */
function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/g) ?? [];
  return blocks
    .map((b) => {
      const atomLink = b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) ?? b.match(/<link[^>]*href="([^"]+)"/);
      const url = tag(b, 'link') || (atomLink ? decode(atomLink[1]) : '');
      const date = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
      return { title: tag(b, 'title'), url, published: new Date(date).toISOString() };
    })
    .filter((i) => i.title && /^https?:/.test(i.url));
}

async function fetchFeed(request, feed) {
  const res = await request.get(feed.url, { headers: { 'user-agent': UA }, timeout: 30_000 });
  if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
  let items = parseFeed(await res.text());
  // even "AI" tag feeds carry off-topic live blogs; keep headlines that say AI
  items = items.filter((i) => AI_WORDS.test(i.title));
  items.sort((a, b) => b.published.localeCompare(a.published));
  return items.slice(0, PER_FEED).map((i) => ({ ...i, publisher: feed.publisher }));
}

/** Clicks the usual consent buttons in the page and its frames (Sourcepoint, OneTrust, ...). */
async function dismissConsent(page) {
  const label = /^(accept( all)?( cookies)?|i accept|agree|i agree|allow all|got it|ok|yes, i('| a)m happy|continue)$/i;
  for (const frame of page.frames()) {
    try {
      const buttons = frame.locator('button, [role=button], a.button');
      const n = Math.min(await buttons.count(), 80);
      for (let i = 0; i < n; i++) {
        const b = buttons.nth(i);
        const text = ((await b.innerText({ timeout: 300 }).catch(() => '')) || '').trim();
        if (label.test(text) && (await b.isVisible().catch(() => false))) {
          await b.click({ timeout: 1500 }).catch(() => {});
          await page.waitForTimeout(800);
          break;
        }
      }
    } catch {}
  }
}

/** Removes overlays that would cover the headline: fixed/sticky bars, consent iframes, modals. */
const CLEAN_PAGE = () => {
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'sticky') el.remove();
  }
  document.querySelectorAll('iframe[src*="consent"], iframe[id^="sp_message"], [id*="cookie" i], [class*="cookie-banner" i]').forEach((e) => e.remove());
  for (const el of [document.documentElement, document.body]) {
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('position', 'static', 'important');
  }
};

/** Viewport-relative rect of the headline block: the h1 plus its header / dek when compact. */
const HEADLINE_RECT = () => {
  const h1 = [...document.querySelectorAll('h1')].find((h) => {
    const r = h.getBoundingClientRect();
    return r.width > 200 && r.height > 20 && h.innerText.trim().length > 15;
  });
  if (!h1) return null;
  h1.scrollIntoView({ block: 'center' });
  window.scrollBy(0, -120);
  const hr = h1.getBoundingClientRect();
  const hasMedia = (el) => !!el.querySelector('img, picture, video, figure, svg[width]');
  const union = (b, r) => ({
    top: Math.min(b.top, r.top), left: Math.min(b.left, r.left),
    right: Math.max(b.right, r.right), bottom: Math.max(b.bottom, r.bottom),
  });
  let box = { top: hr.top, left: hr.left, right: hr.right, bottom: hr.bottom };
  let block = h1;
  // grow to the enclosing header block if it stays text-only and headline-sized
  for (let el = h1.parentElement, depth = 0; el && depth < 4; el = el.parentElement, depth++) {
    const r = el.getBoundingClientRect();
    if (r.height > 480 || r.width > 1240 || hasMedia(el)) break;
    box = union(box, r);
    block = el;
    if (el.tagName === 'HEADER') break;
  }
  // too thin on its own: pull in the standfirst / byline that follow
  for (let sib = block.nextElementSibling; sib && box.bottom - box.top < 200; sib = sib.nextElementSibling) {
    const r = sib.getBoundingClientRect();
    if (hasMedia(sib) || r.bottom - box.top > 420) break;
    if (r.height > 0 && r.width > 0) box = union(box, r);
  }
  const pad = 28;
  return {
    x: Math.max(0, box.left - pad),
    y: Math.max(0, box.top - pad),
    width: Math.min(window.innerWidth, box.right + pad) - Math.max(0, box.left - pad),
    height: box.bottom - box.top + 2 * pad,
  };
};

async function screenshot(context, item, file) {
  const page = await context.newPage();
  try {
    await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3500);
    await dismissConsent(page);
    await page.evaluate(CLEAN_PAGE);
    await page.waitForTimeout(500);
    const clip = await page.evaluate(HEADLINE_RECT);
    if (!clip || clip.height < 60) throw new Error('no headline (h1) found');
    await page.waitForTimeout(700);
    await page.screenshot({ path: file, type: 'jpeg', quality: 88, clip });
    return { width: Math.round(clip.width * 1.5), height: Math.round(clip.height * 1.5) };
  } finally {
    await page.close();
  }
}

const executablePath = [process.env.CHROMIUM_PATH, '.chrome/chrome-headless-shell-linux64/chrome-headless-shell'].find(
  (p) => p && existsSync(p),
);
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ executablePath, proxy, args: proxy ? ['--ignore-certificate-errors'] : [],
 });
const context = await browser.newContext({
  userAgent: UA,
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 1.5,
  locale: 'en-US',
  ignoreHTTPSErrors: !!proxy,
});

// feeds go through the browser's network stack (and so through any proxy)
const settled = await Promise.allSettled(FEEDS.map((f) => fetchFeed(context.request, f)));
const items = [];
settled.forEach((r, i) => (r.status === 'fulfilled' ? items.push(...r.value) : console.warn(`skip ${FEEDS[i].publisher}: ${r.reason}`)));
items.sort((a, b) => b.published.localeCompare(a.published));

mkdirSync(OUT, { recursive: true });
// dialogue.json is hand-written; only the scraped files are replaced
for (const f of readdirSync(OUT)) if (/\.jpg$|^news\.json$/.test(f)) rmSync(`${OUT}/${f}`);

const headlines = [];
for (const item of items) {
  const file = `${String(headlines.length + 1).padStart(2, '0')}.jpg`;
  try {
    const size = await screenshot(context, item, `${OUT}/${file}`);
    headlines.push({ ...item, file, ...size });
    console.log(`✓ ${item.publisher}: ${item.title}`);
  } catch (e) {
    console.warn(`✗ ${item.publisher}: ${item.title} (${e.message})`);
  }
}
await browser.close();

writeFileSync(`${OUT}/news.json`, `${JSON.stringify({ generated: new Date().toISOString(), headlines }, null, 2)}\n`);
console.log(`${headlines.length} headline screenshots in ${OUT}/`);
