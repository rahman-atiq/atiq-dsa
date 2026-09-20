# CLAUDE.md

Working notes for this repo. Read [README.md](README.md) for the layout;
this file is the things that are easy to get wrong.

## The hard constraints

- **No build step, no framework, no dependencies, no external scripts.**
  Not "prefer not to" — the checker fails on an off-origin `<script>` or
  `<link>`, and the fonts are self-hosted so the app works offline. If a
  task seems to need a bundler, the task is wrong.
- **Pages stay single-file.** A deck or lab keeps its own markup, CSS,
  SVG and logic inside itself. Do not factor a page's internals out into
  `shared/` to remove duplication between pages — these are teaching
  artefacts meant to be readable end to end on their own. Only chrome
  and tokens are shared.
- **One list.** `shared/catalog.js` is the single source of truth for
  what exists. The hub cards, the breadcrumb, the sibling link, the track
  cards and the service worker's precache set all read it. Never
  hand-maintain a second copy of that list anywhere — that defect is the
  reason half of `docs/PLAN.md` exists.
- **Topics belong to tracks, tracks own hubs.** `dsa` is the front door,
  `python` sits beside it, and a topic with no `track` is a DSA topic. A
  hub shows only its own track's topics and its own track's Continue. The
  home link and `H` go to the page's own hub, not to `index.html` — read
  the header comment in `shared/chrome.js` before changing that.
- **`sw.js` ships with the literal `__BUILD__`.** CI substitutes the
  commit sha. Never commit a stamped one.

## Before you say you are done

```sh
node scripts/check.mjs
```

It is fast, has no dependencies, and catches the whole class of bugs that
are invisible in a diff: a page missing from the catalog (and so from the
offline copy), a dead link, a second theme key, a page that lost its
pre-paint theme script, a title left as a placeholder. CI runs the same
script before deploying, so a red checker is a blocked deploy.

For anything visual, also serve it and look:

```sh
python3 -m http.server 8000
```

Check both themes. The chrome bar reads only shared tokens, so a page
that looks right in light and wrong in dark has almost always aliased a
token to a hard-coded colour.

## Touching a page

A hub page names its track in `data-topic` (`python`), except the front
door, which says `hub` because it predates tracks. Both are `data-kind="hub"`,
and the checker holds each hub file to the track that claims it.

Every page carries the same head: `data-topic` / `data-kind` on `<html>`,
two `theme-color` metas, `shared/tokens.css`, `shared/chrome.css`,
`shared/catalog.js`, `shared/chrome.js`, and one inline pre-paint script
that reads `dsa.theme`. The checker enforces all of it.

Pages do not own any of these any more, and adding them back is a
regression:

- a theme toggle, theme key or theme keybinding — `chrome.js` owns theme
- a hub link or sibling link — that is the chrome bar
- a service worker registration — `chrome.js` registers it once
- a shortcut overlay or slide overview — `?` and `O` are shared

A page opts into navigation by declaring `window.DSA_TRACK` and
`window.DSA_KEYS`, and calling `DSAChrome.moved()` after its own
navigation. The contract is documented in the header comment of
`shared/chrome.js`; that comment is the spec, keep it current.

Colour comes from `--topic-h` in `tokens.css`, keyed off `data-topic`. A
page's own CSS aliases shared tokens onto its local names in one block at
the top of its `<style>` rather than rewriting every rule.

## Writing new content

Decks and labs come from the `dsa-deck` skill. Registering the result
takes four edits — catalog entry, hue, hub icon, page head — and they are
listed in the README under "Adding a topic". The checker will name the
ones you missed.

## House style in this repo

The comments explain *why*, not *what*, and they are load-bearing —
several of them are the only record of a decision. Match that. A comment
that restates the line under it is noise; a comment that says why the
worker does not call `skipWaiting()` is the reason the next person does
not "fix" it.

Prefer plain, old-school JS in `shared/` (it runs in `importScripts` from
the service worker as well as in pages). Inside a single page, modern
syntax is fine.

## State of the work

`docs/PLAN.md` is a five-phase overhaul, Phases 0–4 done. It records what
the app looked like before and why each change was made; read it before
relitigating a decision.

Storage keys in use:

- `dsa.theme` — `auto` | `light` | `dark`, the only key anything writes
- `dsa.progress.<topic>.<kind>` — `{ at, total, ts }`, read by the hub
- the nine legacy per-page theme keys, read once by a migration shim in
  each page's pre-paint script and never written
