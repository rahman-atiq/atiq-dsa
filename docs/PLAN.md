# DSA Deck: visual, usability and detail overhaul

## Context

The repo is 16 single-file HTML pages (8 decks, 8 labs) plus a hub, deployed to GitHub Pages as a PWA. Content is strong. The app problem is that it is four different apps sharing one manifest:

| Surface | Files | Look | Theme key | Nav |
|---|---|---|---|---|
| Hub | `index.html` | dark-only neon glass, Space Grotesk/Inter/JetBrains (Google Fonts) | none | card grid |
| Decks | `recursion.html`, `binary-trees.html`, `avl-trees.html`, `red-black-trees.html`, `b-trees.html`, `heap-sort.html`, `hashing.html`, `graphs.html` | light-first serif paper (Spectral, Google Fonts), teal accent, 3-state theme, hash routing | `deck-theme` | `show()`, `#bar`, `data-chapter` |
| Stage labs | `AVLTreeLab.html`, `BTreeLab.html`, `HeapSortLab.html`, `RedBlackTreeLab.html` | ui-rounded system font, violet/pink, fixed 1280×720 stage scaled by `fit()`, 2-state theme, no hash routing, no media queries, no reduced-motion, ~0 ARIA | `avl-theme`, `bt-theme`, `heap-theme`, `rb-theme` | `go()`, `buildMenu()`, `data-act`/`data-name` |
| Tabbed labs | `BinaryTreeLab.html`, `LinkedListLab.html`, `SortingLab.html`, `MemoryLab.html` | system sans, orange accent, `header.top` + tabs, 3-state theme | `treelab.theme`, `linkedlistlab.theme`, `sortinglab.theme`, `memorylab.theme` | tabs |

Concrete defects found: `heap-sort.html:17` title is the literal placeholder `TITLE — SUBTITLE`; no page links back to the hub; deck/lab siblings do not link to each other (only `binary-trees.html` links to other decks); nine different localStorage theme keys so dark mode resets on every page change; hub stats (`16 / 08 / 08`) and `sw.js` `PRECACHE_URLS` are hand-maintained copies of the card list; the service worker is cache-first with no update prompt so every deploy is invisible until the second visit; manifest `theme_color` (`#05070d`) differs from the hub `theme-color` (`#04060f`).

Decisions already made with the user:
- Hub gets a light variant and follows the shared theme.
- Self-host two font families (a reading serif + a mono), drop Google Fonts.
- Stage labs are marked desktop-only for now (hub badge + landscape hint); no reflow in this plan.

Constraints: no build step, no framework, no external scripts. Pages stay single-file for their content; only chrome/tokens become shared files. GitHub Pages serves from repo root at `/atiq-dsa/`.

## Phases (each phase is one branch / PR, in this order)

### Phase 0: Hull breaches (small, do first)

1. `heap-sort.html:17`: set title to `Heap Sort — the array that thinks it's a tree, and how to build one in C` (match the sibling decks' pattern).
2. Unify theme storage. Replace every page's key with `dsa.theme` and values `auto | light | dark`:
   - Decks: the `'deck-theme'` string (3 occurrences per deck).
   - Stage labs: `initTheme()` and the toggle in each (`"bt-theme"` etc.); upgrade from 2-state to the decks' 3-state cycle.
   - Tabbed labs: `THEME_KEY` constant plus the pre-paint `<script>` in `<head>` (`SortingLab.html:15`, `SortingLab.html:892` and equivalents).
   - Hub: add the same pre-paint script (light variant lands in Phase 1; for now the key is just read and written).
   - One-time migration: on load, if `dsa.theme` is unset, read the legacy key for that page and copy it over.
3. `manifest.webmanifest`: set `theme_color` and `background_color` to `#04060f`; set every page's `<meta name="theme-color">` to the same. Later, Phase 1 makes this dynamic per theme via a `media` attribute pair.
4. Cross-links (temporary until Phase 1's chrome bar replaces them): add a `← Hub` link in each deck's `#bar` and each lab's header; add "Open the lab / Open the deck" links on the title slide of each of the five paired topics (binary trees, AVL, red-black, B-tree, heap).

### Phase 1: Shared tokens and chrome (biggest visible change)

New files:
- `shared/tokens.css`: colour/type/spacing custom properties, light + dark, using the guarded pattern already correct in `b-trees.html` (`@media (prefers-color-scheme:dark){:root:not([data-theme="light"])…}` plus explicit `:root[data-theme="dark"]` and `:root[data-theme="light"]`). Source the palette from `b-trees.html` (newest, dark-mode audited). Add a per-topic accent: `--topic-h` (hue), reusing the exact hue numbers the hub already assigns as `--card-h` in `index.html` so the card colour equals the page accent.
- `shared/chrome.css` + `shared/chrome.js`: a fixed top bar rendered by JS from a `data-topic` attribute on `<html>`: hub link, breadcrumb (`Decks › B-Trees`), sibling switch button when a pair exists, 3-state theme toggle (moves out of the deck `#bar` and lab headers), `?` shortcut-help overlay. `chrome.js` owns theme read/write (`dsa.theme`) so every page deletes its own copy.
- `shared/catalog.js`: single source of truth. One entry per topic: `{ id, title, blurb, hue, deck?: file, lab?: file, desktop?: bool, slides?: n }`. Consumed by the hub (renders cards + stats), `chrome.js` (breadcrumb + sibling link), and `sw.js` (precache list via `importScripts`).
- `fonts/`: self-hosted woff2 for Spectral (400/500/600/700, 400 italic) and JetBrains Mono (400/500/700), with `@font-face` in `tokens.css` using `font-display: swap`. Hub switches from Space Grotesk/Inter to Spectral for headings + system sans for UI text. Remove every `fonts.googleapis.com` link and preconnect.

Per-page migration (pattern, applied to all 16 pages + hub):
1. Add `<link rel="stylesheet" href="shared/tokens.css">` then `shared/chrome.css` before the inline `<style>`; add `<script src="shared/chrome.js" defer>` and `data-topic="b-trees"` on `<html>`.
2. Map the page's local token names onto shared ones (`--paper→--bg`, `--ink→--fg`, `--accent→--accent` etc.) by aliasing in a small block at the top of the page's inline CSS rather than rewriting every rule. Delete the page's now-duplicate light/dark palette blocks.
3. Delete the page's own theme toggle button and JS. Deck `#bar` keeps count/prev/next/chapter.
4. Add `padding-top` for the chrome bar (decks: `.slide` top padding; stage labs: `fit()` subtracts the bar height; tabbed labs: `header.top` sits below it).

Hub (`index.html`):
- Light palette for `.sky`, `.orb`, `.glass`, card borders and text tokens; keep the dark look as the dark variant.
- Render cards from `catalog.js`, grouped by topic (one row per topic with Deck / Lab actions) instead of two grids; stats derived from the catalog.
- Desktop badge on stage-lab entries (`desktop: true`).

Stage labs: add a `@media (max-width: 760px)` block showing a "rotate to landscape or open on a wider screen" panel; add `@media (prefers-reduced-motion: reduce)` disabling `.blob` drift, `march`, `pulse`, `nudge` and `slideIn`.

### Phase 2: Navigation and resume

- Stage labs: add hash routing to `go()` mirroring the decks' `show()` (`history.replaceState(null,'','#'+(i+1))`, read `location.hash` on boot). All four labs share the same `go()` shape so this is one patch applied four times.
- `chrome.js`: on every slide change (decks `show()`, stage labs `go()`, tabbed labs tab change) write `dsa.progress.<topic-id> = { at, total, ts }`.
- Hub: "Continue" card at the top from the most recent `dsa.progress.*`; per-card progress ring/percent.
- Decks: slide overview (`O` or `Esc`) built from `data-chapter`, the way stage labs already do with `buildMenu()`; lift `buildMenu()` into `chrome.js` so decks and stage labs share it.
- `?` overlay lists: `← →` / `PgUp PgDn`, `Home End`, `T` theme, `O` overview, `H` hub, plus the page's own keys (labs pass an extra list).
- View Transitions: `@view-transition { navigation: auto; }` in `chrome.css` for a cross-fade between pages (progressive; no-op where unsupported).

### Phase 3: Details and accessibility

- Stage labs: `aria-label` on every control button, `role="img"` + `aria-label` on each `.tree` SVG, an `aria-live="polite"` region that mirrors the step narration text, move focus to the slide heading on `go()`.
- Consistent `<title>` pattern: `B-Trees · Deck · Atiq's DSA` / `B-Trees · Lab · Atiq's DSA`.
- Dynamic `theme-color`: two `<meta name="theme-color" media="(prefers-color-scheme: …)">` tags, updated by `chrome.js` on toggle.
- Print CSS for labs (decks already have `@media print`).

### Phase 4: Infrastructure

- `sw.js`: cache name becomes `dsa-deck-${BUILD}` where the Pages workflow does `sed -i "s/__BUILD__/${GITHUB_SHA::8}/" sw.js` before upload; precache list comes from `catalog.js`; on `updatefound` + `statechange: installed` with an existing controller, `chrome.js` shows a "New version, reload" toast.
- `.github/workflows/pages.yml`: add a `check` job before deploy running `scripts/check.mjs` (Node, no deps): every `href` to a local `.html` resolves; no `<script src` or `<link href` pointing off-origin except none; exactly one localStorage theme key (`dsa.theme`) across all pages; no `TITLE — SUBTITLE`; every catalog entry's files exist and every `.html` (except hub) is in the catalog.
- `README.md` + `CLAUDE.md`: no build step, how pages are structured, shared files, how to add a module with the dsa-deck skill and register it in `catalog.js`.

## Critical files

- `index.html` (hub rewrite onto catalog + light variant)
- `b-trees.html` (reference deck for tokens; first deck migrated)
- `BTreeLab.html` (reference stage lab; first lab migrated)
- `SortingLab.html` (reference tabbed lab; first migrated)
- `heap-sort.html` (title fix)
- `sw.js`, `manifest.webmanifest`, `.github/workflows/pages.yml`
- New: `shared/tokens.css`, `shared/chrome.css`, `shared/chrome.js`, `shared/catalog.js`, `fonts/*.woff2`, `scripts/check.mjs`, `README.md`, `CLAUDE.md`

## Verification

- Before Phase 1, capture baseline screenshots of every page in light and dark at 1440×900 and 390×844 with a throwaway Playwright script in the scratchpad (`npx playwright screenshot` per URL against `python3 -m http.server`); re-run after each phase and eyeball diffs. This is the regression net for 16 hand-tuned pages.
- Phase 0: open any deck, set dark, navigate to the hub and to a lab; theme must persist. `grep -l "TITLE — SUBTITLE" *.html` returns nothing. `grep -ho "localStorage\.[gs]etItem('[^']*'" *.html | sort -u` shows only `dsa.theme` (plus legacy reads inside the migration shim).
- Phase 1: DevTools Network tab shows no request to `fonts.googleapis.com`/`gstatic`; offline mode (SW installed, network disabled) renders fonts correctly; every page shows the chrome bar and the hub link works; hub renders in light and dark; stage lab at 390px width shows the landscape panel.
- Phase 2: reload a stage lab mid-way and land on the same slide; hub shows the Continue card; `O` opens the overview on a deck; Back/forward between pages cross-fades in Chrome.
- Phase 3: VoiceOver reads control names in a stage lab; `prefers-reduced-motion` stops the blobs.
- Phase 4: push to a branch, run the workflow with `workflow_dispatch`, confirm `check` fails when a deliberate broken link is added and passes when removed; after deploy, an already-open tab shows the reload toast.
