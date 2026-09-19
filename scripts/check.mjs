/* ============================================================
   scripts/check.mjs — the gate in front of a deploy.

   Seventeen hand-written single-file pages and four lists that
   describe them (the catalog, the precache set, the font files, the
   chrome contract each page has to honour). Nothing here type-checks
   anything; it only asks whether those lists still agree with the
   file tree and with each other, because every defect this repo has
   actually shipped was a copy of a list going quietly out of date.

   Node, no dependencies, no build step -- same rule as the app.

     node scripts/check.mjs

   Exits 0 with a summary, or 1 with one line per problem.
   ============================================================ */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const checks = [];

function fail(file, msg) { problems.push({ file, msg }); }
function read(p) { return readFileSync(join(ROOT, p), 'utf8'); }
function has(p) { return existsSync(join(ROOT, p)); }

/* A check is a named block so the summary can say what ran, not just
   that nothing exploded. */
function check(name, fn) {
  const before = problems.length;
  fn();
  checks.push({ name, found: problems.length - before });
}

/* ---------------- the inputs ---------------- */

const htmlFiles = readdirSync(ROOT)
  .filter((f) => f.endsWith('.html'))
  .sort();

/* catalog.js is a classic script that hangs one object off `self`.
   Running it is better than parsing it: the check then fails the same
   way the browser would if the file stopped being valid. */
const catalog = (() => {
  const shim = {};
  new Function('self', read('shared/catalog.js'))(shim);
  return shim.DSA_CATALOG;
})();

/* Everything the page-level checks want, gathered once.

   Script bodies are blanked before any markup is inspected. Several
   pages build HTML inside template literals -- `<title>${esc(call)}</title>`
   in recursion.html is the loud example -- and a link checker that walks
   into those is a link checker that reports on code paths instead of on
   the document. The raw text is kept for the checks that want the code. */
const pages = htmlFiles.map((file) => {
  const raw = read(file);
  const shell = raw.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2');
  const head = shell.slice(0, shell.search(/<\/head>/i) + 1 || shell.length);
  /* Same slice with the code left in, for the checks that care what the
     <head> runs rather than what it links to. */
  const rawHead = raw.slice(0, raw.search(/<\/head>/i) + 1 || raw.length);
  return { file, raw, shell, head, rawHead };
});

/* ---------------- 1. the catalog is the file tree ---------------- */

check('catalog matches the file tree', () => {
  const listed = new Set();

  for (const t of catalog.topics) {
    if (!t.deck && !t.lab) fail('shared/catalog.js', `"${t.id}" has neither a deck nor a lab`);
    for (const f of [t.deck, t.lab].filter(Boolean)) {
      listed.add(f);
      if (!has(f)) fail('shared/catalog.js', `"${t.id}" points at ${f}, which does not exist`);
    }
  }

  for (const f of htmlFiles) {
    if (f === 'index.html') continue;
    if (!listed.has(f)) fail(f, 'exists but no catalog entry points at it');
  }

  /* Both directions for the asset lists too: a precache list that has
     drifted from the file tree is an offline bug nobody sees until the
     network is gone. */
  for (const f of [...catalog.shared, ...catalog.icons, ...catalog.fonts]) {
    if (!has(f)) fail('shared/catalog.js', `precache list names ${f}, which does not exist`);
  }
  const fonts = new Set(catalog.fonts);
  for (const f of readdirSync(join(ROOT, 'fonts'))) {
    if (f.endsWith('.woff2') && !fonts.has('fonts/' + f)) {
      fail('shared/catalog.js', `fonts/${f} is on disk but not in the precache list`);
    }
  }
});

/* ---------------- 2. every local link resolves ---------------- */

const SKIP = /^(#|\/\/|https?:|mailto:|tel:|data:|blob:|javascript:)/i;

function localTargets(text, base) {
  const out = [];
  const re = /\b(?:href|src)\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(text))) {
    const url = m[1].trim();
    if (!url || SKIP.test(url)) continue;
    const clean = url.split(/[?#]/)[0];
    if (!clean) continue;
    out.push({ url, path: resolve(base, clean) });
  }
  return out;
}

check('local links resolve', () => {
  for (const p of pages) {
    for (const t of localTargets(p.shell, ROOT)) {
      if (!existsSync(t.path)) fail(p.file, `link to ${t.url} resolves to nothing`);
    }
  }

  /* CSS carries its own references, and they are relative to the
     stylesheet rather than to the page. */
  for (const css of ['shared/tokens.css', 'shared/chrome.css']) {
    const text = read(css);
    const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    let m;
    while ((m = re.exec(text))) {
      const url = m[1].trim();
      if (SKIP.test(url)) continue;
      if (!existsSync(resolve(join(ROOT, dirname(css)), url.split(/[?#]/)[0]))) {
        fail(css, `url(${url}) resolves to nothing`);
      }
    }
  }

  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const icon of manifest.icons || []) {
    if (!has(icon.src)) fail('manifest.webmanifest', `icon ${icon.src} does not exist`);
  }
});

/* ---------------- 3. nothing loads from off-origin ---------------- */

check('no off-origin assets', () => {
  for (const p of pages) {
    const re = /<(script|link)\b[^>]*\b(?:src|href)\s*=\s*"((?:https?:)?\/\/[^"]*)"/gi;
    let m;
    while ((m = re.exec(p.shell))) fail(p.file, `<${m[1]}> loads ${m[2]} from off-origin`);
    if (/fonts\.(googleapis|gstatic)\.com/i.test(p.raw)) {
      fail(p.file, 'still mentions Google Fonts; the faces are self-hosted in fonts/');
    }
  }
  for (const css of ['shared/tokens.css', 'shared/chrome.css']) {
    if (/@import\s+url\(\s*['"]?(?:https?:)?\/\//i.test(read(css))) {
      fail(css, '@import pulls a stylesheet from off-origin');
    }
  }
});

/* ---------------- 4. one theme key ---------------- */

/* Read-only, and only inside the pre-paint migration shim: a reader who
   set dark on the old key should not be greeted by a white flash. Once
   these have had a year to run they can go, and so can this list. */
const LEGACY = new Set([
  'deck-theme', 'avl-theme', 'bt-theme', 'heap-theme', 'rb-theme',
  'treelab.theme', 'linkedlistlab.theme', 'sortinglab.theme', 'memorylab.theme'
]);

check('one theme key across the app', () => {
  const sources = [...pages.map((p) => ({ file: p.file, raw: p.raw })),
    ...['shared/chrome.js', 'shared/catalog.js'].map((f) => ({ file: f, raw: read(f) }))];

  for (const s of sources) {
    const re = /localStorage\s*\.\s*(getItem|setItem)\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(s.raw))) {
      const [, op, key] = m;
      if (key === 'dsa.theme' || key.startsWith('dsa.progress.')) continue;
      if (op === 'getItem' && LEGACY.has(key)) continue;
      fail(s.file, `localStorage.${op}("${key}") — the app stores under dsa.theme`);
    }
  }
});

/* ---------------- 5. the chrome contract ---------------- */

const ids = new Set(catalog.topics.map((t) => t.id));
const KINDS = new Set(['deck', 'lab', 'hub']);

function attr(text, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(text);
  return m ? m[1] : null;
}

check('every page wears the shared chrome', () => {
  for (const p of pages) {
    const html = /<html\b[^>]*>/i.exec(p.raw);
    const tag = html ? html[0] : '';
    const topic = attr(tag, 'data-topic');
    const kind = attr(tag, 'data-kind');

    if (!topic) fail(p.file, '<html> has no data-topic');
    else if (topic !== 'hub' && !ids.has(topic)) fail(p.file, `data-topic="${topic}" is not a catalog id`);
    if (!kind || !KINDS.has(kind)) fail(p.file, `data-kind="${kind}" is not deck, lab or hub`);

    /* The catalog and the page have to agree about which is which. */
    if (topic && topic !== 'hub' && ids.has(topic) && (kind === 'deck' || kind === 'lab')) {
      const entry = catalog.byId(topic);
      if (entry[kind] !== p.file) {
        fail(p.file, `says it is the ${topic} ${kind}, but the catalog names ${entry[kind] || 'nothing'}`);
      }
    }

    for (const need of ['shared/tokens.css', 'shared/chrome.css', 'shared/catalog.js', 'shared/chrome.js']) {
      if (!p.head.includes(need)) fail(p.file, `<head> does not load ${need}`);
    }

    const metas = p.head.match(/<meta\s+name="theme-color"[^>]*>/gi) || [];
    if (metas.length !== 2 || !metas.some((m) => /prefers-color-scheme:\s*light/.test(m))
      || !metas.some((m) => /prefers-color-scheme:\s*dark/.test(m))) {
      fail(p.file, 'needs exactly two theme-color metas, one per scheme');
    }

    /* Registration moved into shared/chrome.js in one place. */
    if (/navigator\s*\.\s*serviceWorker\s*\.\s*register/.test(p.raw)) {
      fail(p.file, 'registers the service worker itself; shared/chrome.js does that now');
    }

    /* The one thing that cannot be shared: chrome.js is deferred, so a
       page without its own inline snippet paints white first and then
       goes dark, which is worse than either theme on its own. */
    if (!/localStorage\s*\.\s*getItem\s*\(\s*'dsa\.theme'\s*\)/.test(p.rawHead)) {
      fail(p.file, '<head> has no pre-paint theme script; dark mode will flash white');
    }
  }
});

/* ---------------- 6. titles ---------------- */

check('titles follow the pattern', () => {
  for (const p of pages) {
    const m = /<title>([^<]*)<\/title>/i.exec(p.head);
    if (!m) { fail(p.file, 'has no <title>'); continue; }
    const title = m[1].trim();
    if (!title || /TITLE|SUBTITLE|Untitled/.test(title)) {
      fail(p.file, `title is still a placeholder: "${title}"`);
    } else if (p.file !== 'index.html') {
      const kind = attr(/<html\b[^>]*>/i.exec(p.raw)[0], 'data-kind');
      const want = `· ${kind === 'lab' ? 'Lab' : 'Deck'} · Atiq's DSA`;
      if (!title.endsWith(want)) fail(p.file, `title should end "${want}", is "${title}"`);
    }
  }

  /* The placeholder the skill leaves behind, anywhere at all. */
  for (const p of pages) {
    if (p.raw.includes('TITLE — SUBTITLE')) fail(p.file, 'contains the TITLE — SUBTITLE placeholder');
  }
});

/* ---------------- 7. the service worker ships unstamped ---------------- */

check('service worker is stamped at deploy time', () => {
  const sw = read('sw.js');
  const stamps = (sw.match(/__BUILD__/g) || []).length;
  if (stamps === 0) {
    fail('sw.js', 'no __BUILD__ placeholder — a stamped sw.js must not be committed');
  } else if (stamps > 1) {
    /* The workflow stamps with a plain `sed s/__BUILD__/sha/`, which takes
       the first match on a line. A second copy — in a comment, say — eats
       the substitution and leaves the cache name frozen while the file's
       bytes still change: the reader gets an update prompt for a build
       that never arrives. */
    fail('sw.js', `__BUILD__ appears ${stamps} times; the deploy sed only replaces the first`);
  }
  if (!sw.includes("importScripts('shared/catalog.js')")) {
    fail('sw.js', 'no longer reads the catalog; the precache list would be a second copy');
  }
  if (!/const CACHE\s*=\s*'dsa-deck-'\s*\+\s*BUILD/.test(sw)) {
    fail('sw.js', 'cache name is not derived from the build stamp');
  }
});

/* ---------------- the verdict ---------------- */

const width = Math.max(...checks.map((c) => c.name.length));
for (const c of checks) {
  const mark = c.found ? '✗' : '✓';
  console.log(`${mark} ${c.name.padEnd(width)}  ${c.found ? c.found + ' problem' + (c.found > 1 ? 's' : '') : 'ok'}`);
}

if (problems.length) {
  console.log('');
  const byFile = new Map();
  for (const p of problems) {
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file).push(p.msg);
  }
  for (const [file, msgs] of [...byFile].sort()) {
    console.log(file);
    for (const m of msgs) console.log('  ' + m);
  }
  console.log(`\n${problems.length} problem${problems.length > 1 ? 's' : ''} in ${byFile.size} file${byFile.size > 1 ? 's' : ''}.`);
  process.exit(1);
}

console.log(`\n${pages.length} pages, ${catalog.topics.length} topics, ${catalog.pages().length} precached. All clear.`);
