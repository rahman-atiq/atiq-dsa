# Atiq's DSA

Interactive teaching decks and hands-on labs. Nine decks you read, eight
labs you drive, and a hub in front of each track: data structures and
algorithms at the front door, Python beside it. It installs as a PWA and
works with the network off.

Live at **https://rahman-atiq.github.io/atiq-dsa/** (GitHub Pages, from
the repo root of `main`).

## Running it

There is no build step. There are no dependencies. There is nothing to
install.

```sh
python3 -m http.server 8000     # or any static server
open http://localhost:8000/
```

A `file://` open mostly works too, but the service worker is skipped and
the fonts may not load, so use a server for anything you intend to trust.

Before pushing:

```sh
node scripts/check.mjs
```

That is the same script CI runs, and it is the whole test suite. See
[Checks](#checks).

## How it is laid out

```
index.html            the DSA hub, and the front door: cards from the catalog
python.html           the Python hub, same shape, its own track
<topic>.html          a deck — slides you read, argued from problem to solution
<Topic>Lab.html       a lab — a thing you drive
shared/               the only code more than one page shares
  tokens.css          colours, type, spacing, the per-topic accent hue
  chrome.css          the top bar, the ? overlay, the overview, the toast
  chrome.js           builds all of that, and owns theme + progress + the SW
  catalog.js          the list of what exists — read by the hub, chrome and sw
fonts/                Spectral and JetBrains Mono, self-hosted, subset per range
icons/                PWA icons
sw.js                 the service worker, precaching from the catalog
scripts/check.mjs     the gate CI runs before deploying
docs/PLAN.md          the overhaul this repo is midway through
```

**Every page is one file.** A deck or a lab keeps its own markup, styles,
SVG and logic inside itself — you can open `b-trees.html` on its own and
it is complete. Only the chrome around it is shared. That is deliberate:
these are teaching artefacts, and one of them being readable end to end
in a single file is worth more than the duplication it costs.

**The four things a page borrows** are all in `shared/`, and every page
links them the same way:

```html
<html lang="en" data-topic="b-trees" data-kind="deck">
  <link rel="stylesheet" href="shared/tokens.css">
  <link rel="stylesheet" href="shared/chrome.css">
  <script src="shared/catalog.js" defer></script>
  <script src="shared/chrome.js" defer></script>
```

`data-topic` selects the topic's accent hue from `tokens.css` and its
catalog entry; `data-kind` is `deck`, `lab` or `hub`. On a hub page
`data-topic` is the track's id instead (`python`), or `hub` on the front
door, which predates tracks. A page also carries
one inline snippet in its `<head>` that reads `dsa.theme` before first
paint — `chrome.js` is deferred, so without it a dark-theme reload flashes
white.

Pages do not style themselves from scratch. They alias the shared tokens
onto whatever names their own CSS was written with:

```css
:root{ --paper:var(--bg); --ink:var(--fg); --dim:var(--fg-dim); }
```

A custom property holding `var(--x)` re-resolves when `--x` moves, so one
alias block per page is all that theming costs.

## What chrome.js does for a page

It builds the top bar, owns the theme (one key, `dsa.theme`, three states),
draws the `?` shortcut overlay and the `O` slide overview, records where
the reader got to so the hub can offer to continue, announces slide changes
to screen readers, and registers the service worker.

A page opts into the parts it needs by declaring two globals before the
deferred script runs — the end of the page's own inline script is early
enough:

```js
window.DSA_TRACK = {
  unit:    'slide',                 // or 'section'
  title:   'Jump to a slide',       // omit for no overview
  items:   function(){ return [{ group, name }, ...]; },
  current: function(){ return idx; },
  go:      function(i){ ... }
};

window.DSA_KEYS = [['← →', 'Previous slide / next slide']];
```

and calls `window.DSAChrome && DSAChrome.moved()` once its own navigation
has finished. That is the entire contract. Anything else worth saying out
loud goes through `DSAChrome.announce(text)`.

The full documentation is the comment block at the top of
[`shared/chrome.js`](shared/chrome.js), which is kept honest by being the
thing that actually runs.

## Tracks

A track is a subject area with its own hub. `dsa` is the original one and
its hub is the front door; `python` sits beside it. A topic belongs to
exactly one track and appears only on that track's hub, which is the whole
reason the field exists — a single list of every page in the app stopped
being a useful front door at about eleven entries.

```js
{ id: 'python', title: 'Python', hub: 'python.html', icon: 'i-python',
  blurb: 'One line for the track card on the other hub.' }
```

Consequences worth knowing:

- A topic with no `track` is a DSA topic. The eleven that predate tracks
  say nothing, and adding the field to all of them would have been eleven
  chances to typo the same string.
- The chrome bar's home link and the `H` key go to the hub of the page's
  **own** track, so a Python deck lands back on the Python hub and that
  hub goes up to the front door. Off the front door, the link is labelled
  with the track's name rather than "Hub", because it goes somewhere
  different from page to page.
- Each hub shows the other tracks as cards, and filters Continue to its
  own — being offered slide 14 of a Python deck from the DSA front door is
  a category error, not a convenience.
- Exactly one track is `root: true`. The checker enforces it: two means
  every home link is a coin toss, none means they have nowhere to land.

Adding a track means a catalog entry, a hue in `tokens.css`, and a hub
page. The hub is the one piece of deliberate duplication in the repo —
`python.html` is `index.html`'s structure with its own palette and its own
copy of the rendering script, because pages stay single-file and only the
chrome and tokens are shared.

## Adding a topic

Decks and labs are written with the `dsa-deck` skill, which produces the
single-file HTML. Once you have the file:

1. **Register it in `shared/catalog.js`.** One entry, and nothing else in
   the app keeps a second copy of this list — the hub cards, the
   breadcrumb, the sibling link and the offline precache set all read it.

   ```js
   { id: 'tries', title: 'Tries', blurb: 'One line for the hub card.',
     icon: 'i-trie', deck: 'tries.html', lab: 'TrieLab.html',
     desktop: true }
   ```

   Add `track: 'python'` for a Python topic. Leaving it out means DSA.

   `desktop: true` marks a fixed-stage lab that does not reflow below
   ~760px; the hub badges it and the lab shows a "turn the phone sideways"
   panel instead of pretending.

2. **Give it a hue** in `shared/tokens.css`, next to the other
   `[data-topic="…"]` rules. One hue drives the page accent and the hub
   card both.

3. **Add its icon** to the inline `<defs>` sprite in the hub that will
   show it — `index.html` or `python.html` — under the id you put in
   `icon`. Each hub carries only the glyphs it draws.

4. **Wire the page's head** as above, with a `<title>` of
   `Tries · Deck · Atiq's DSA`.

5. `node scripts/check.mjs`, which will tell you which of those you forgot.

## Checks

`scripts/check.mjs` is Node with no dependencies and no config. It does
not type-check anything. It asks whether the lists still agree with the
file tree and with each other, because every defect this repo has actually
shipped was a copy of a list going quietly out of date:

- the catalog and the `.html` files on disk name each other, both ways
- every local `href`/`src`/`url()` resolves to something
- nothing loads from off-origin (the fonts are self-hosted on purpose)
- `dsa.theme` is the only key anything writes
- every page carries the chrome contract, two `theme-color` metas and a
  pre-paint theme script
- titles follow `Topic · Deck · Atiq's DSA`, with no placeholders left
  (a hub only has to name the set)
- every track has a hub that exists, no two tracks claim the same file,
  exactly one is the front door, and every topic's `track` is a real one
- `sw.js` still holds `__BUILD__` and still reads the catalog

## Deploying

Push to `main`. The workflow runs `check`, then stamps the service worker
and uploads the repo as the Pages artifact.

The stamping matters. `sw.js` carries the literal `__BUILD__` in the repo
and gets the commit sha substituted on the way to the artifact, which
makes the cache name `dsa-deck-<sha>`. A service worker whose bytes never
change is one the browser never re-fetches — without this, a deploy stays
invisible until the reader closes every tab. With it, the new worker
installs, waits, and `chrome.js` offers a reload. Nothing refreshes on its
own; being yanked out of slide 19 is not an upgrade.

**Never commit a stamped `sw.js`.** The check will stop you.

## Browser support

Modern evergreen browsers. Progressive enhancements degrade rather than
break: the cross-fade between pages is Chrome-only and a no-op elsewhere,
`color-mix` has an opaque fallback, and the whole app works with
JavaScript doing nothing but the page's own.
