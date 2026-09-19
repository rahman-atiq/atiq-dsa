/* ============================================================
   shared/chrome.js — the top bar, the theme, the `?` overlay,
   the slide overview, and the resume bookkeeping.

   Loaded deferred, after shared/catalog.js, on every page. It reads
   two attributes off <html>:

     data-topic  an id from the catalog ('b-trees'), or 'hub'
     data-kind   'deck' | 'lab' | 'hub'

   and builds the bar from the catalog entry. It also owns the theme
   outright: no page keeps its own toggle, key binding or storage
   call any more. Pages that need to know when the palette moved --
   the decks redraw SVG built from custom-property values -- listen
   for the `dsa:theme` event on document.

   A page may declare its own shortcuts before this runs:
     window.DSA_KEYS = [['← →', 'Previous / next slide'], ...];
   Inline scripts in <body> execute before deferred ones, so a page
   setting that at the end of its own script is always in time.

   A page with a sequence the reader moves through -- deck slides,
   lab slides, lab sections -- declares it the same way:

     window.DSA_TRACK = {
       unit:    'slide' | 'section',    // what one item is called
       title:   'Jump to a slide',      // heading; omit for no overview
       items:   function(){ return [{group, name, hash}, ...]; },
       current: function(){ return idx; },        // 0-based
       go:      function(i){ ... }                // move there
     };

   Given that, this file owns three things the pages used to each do
   badly or not at all: the `#n` in the address bar, the O overview,
   and the `dsa.progress.<topic>.<kind>` record the hub reads to offer
   "continue where you left off". The page's own navigation function
   calls `window.DSAChrome && DSAChrome.moved()` once it has moved --
   that is the whole contract.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var topicId = root.getAttribute('data-topic') || '';
  var kind = root.getAttribute('data-kind') || '';
  var catalog = window.DSA_CATALOG || null;
  var topic = (catalog && catalog.byId(topicId)) || null;
  var track = window.DSA_TRACK || null;

  /* ---------------- theme ----------------
     One key for the whole app. The pre-paint snippet in each page's
     <head> has already applied it; this only handles changes.      */
  var KEY = 'dsa.theme';
  var MODES = ['auto', 'light', 'dark'];
  var LABEL = { auto: '◐ Auto', light: '☀ Light', dark: '☾ Dark' };
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var mode = 'auto';
  var themeBtn = null;

  function readTheme() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    return MODES.indexOf(v) >= 0 ? v : 'auto';
  }

  function resolved() {
    return mode === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : mode;
  }

  function applyTheme(persist) {
    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);

    if (persist) { try { localStorage.setItem(KEY, mode); } catch (e) {} }

    if (themeBtn) {
      themeBtn.textContent = LABEL[mode];
      themeBtn.setAttribute('aria-label',
        'Colour theme: ' + mode + (mode === 'auto' ? ' (currently ' + resolved() + ')' : '') +
        '. Click to change.');
    }
    document.dispatchEvent(new CustomEvent('dsa:theme', {
      detail: { mode: mode, resolved: resolved() }
    }));
  }

  function cycleTheme() {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    applyTheme(true);
    return mode;
  }

  function setTheme(next) {
    if (MODES.indexOf(next) < 0) return;
    mode = next;
    applyTheme(true);
  }

  /* ---------------- building blocks ---------------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function span(cls, text) { return el('span', cls, text); }

  /* ---------------- the track ----------------
     Every call into the page's own config is wrapped, because a page
     that throws here would take the whole bar down with it -- and the
     bar is the only way back to the hub.                            */
  function hasOverview() { return !!(track && track.title && track.items && track.go); }

  function items() {
    if (!track || !track.items) return [];
    try { var a = track.items(); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }

  function current() {
    if (!track || !track.current) return -1;
    try { var i = track.current(); return typeof i === 'number' && i >= 0 ? i : -1; } catch (e) { return -1; }
  }

  function hashFor(list, i) {
    var it = list[i] || {};
    return String(it.hash != null ? it.hash : i + 1);
  }

  /* The address bar. replaceState rather than pushState: thirty slides
     of a deck are one page, and Back should leave the deck rather than
     walk you out of it one slide at a time. */
  function syncHash() {
    var list = items(), i = current();
    if (i < 0 || !list.length) return;
    var h = '#' + hashFor(list, i);
    if (location.hash === h) return;
    try { history.replaceState(null, '', h); } catch (e) { location.hash = h; }
  }

  /* ---------------- progress ----------------
     One record per page, not per topic: b-trees.html and BTreeLab.html
     are the same subject but not the same place, and a bookmark in one
     is no use in the other.

     `at` is 1-based, the number a reader sees in the counter.        */
  function progressKey() { return 'dsa.progress.' + topicId + '.' + kind; }

  var progTimer = null;

  function writeProgress() {
    if (progTimer) { clearTimeout(progTimer); progTimer = null; }
    if (!track || !topicId || kind === 'hub') return;
    var list = items(), i = current();
    if (i < 0 || !list.length) return;
    var rec = {
      at: i + 1,
      total: list.length,
      unit: track.unit || 'slide',
      label: (list[i] && list[i].name) || '',
      hash: hashFor(list, i),
      ts: Date.now()
    };
    try { localStorage.setItem(progressKey(), JSON.stringify(rec)); } catch (e) {}
  }

  /* Held back a beat: holding down the arrow key through a deck should
     not be thirty synchronous localStorage writes. */
  function queueProgress() {
    if (progTimer) clearTimeout(progTimer);
    progTimer = setTimeout(writeProgress, 400);
  }

  function flushProgress() { if (progTimer) writeProgress(); }

  window.addEventListener('pagehide', flushProgress);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushProgress();
  });

  /* Called by the page after its own navigation has finished. */
  function moved() {
    if (!track) return;
    syncHash();
    queueProgress();
    if (openName === 'overview') syncOverview();
  }

  /* ---------------- the bar ---------------- */
  function buildBar() {
    var bar = el('header', 'dsa-bar');
    bar.setAttribute('role', 'banner');

    if (kind === 'hub') {
      var brand = span('dsa-home');
      brand.appendChild(span('dsa-glyph', '⌂'));
      brand.appendChild(span('dsa-label', 'Hub'));
      bar.appendChild(brand);
    } else {
      var home = document.createElement('a');
      home.className = 'dsa-home';
      home.href = 'index.html';
      home.setAttribute('aria-label', 'Back to the hub');
      home.appendChild(span('dsa-glyph', '⌂'));
      home.appendChild(span('dsa-label', 'Hub'));
      bar.appendChild(home);
    }

    if (topic) {
      var crumb = el('nav', 'dsa-crumb');
      crumb.setAttribute('aria-label', 'Breadcrumb');
      crumb.appendChild(span('dsa-sep', '/'));
      crumb.appendChild(span('dsa-kind', kind === 'lab' ? 'Lab' : 'Deck'));
      crumb.appendChild(span('dsa-sep', '›'));
      crumb.appendChild(span('dsa-topic', topic.title));
      bar.appendChild(crumb);

      if (kind === 'lab' && topic.desktop) {
        var badge = span('dsa-badge', 'Desktop');
        badge.title = 'This lab uses a fixed stage and needs a wider screen.';
        bar.appendChild(badge);
      }
    }

    bar.appendChild(span('dsa-spacer'));

    /* the other half of the pair, when there is one */
    if (topic) {
      var otherKind = kind === 'deck' ? 'lab' : 'deck';
      var otherFile = topic[otherKind];
      if (otherFile) {
        var sib = document.createElement('a');
        sib.className = 'dsa-sibling';
        sib.href = otherFile;
        sib.appendChild(span('dsa-label',
          otherKind === 'lab' ? 'Open the lab' : 'Open the deck'));
        /* Narrow screens get the short form rather than a bare arrow, which
           tells you nothing about where it goes. */
        sib.appendChild(span('dsa-short', otherKind === 'lab' ? 'Lab' : 'Deck'));
        sib.appendChild(span(null, '→'));
        if (otherKind === 'lab' && topic.desktop) sib.setAttribute('data-desktop', 'true');
        sib.setAttribute('aria-label',
          otherKind === 'lab' ? 'Open the ' + topic.title + ' lab'
                              : 'Open the ' + topic.title + ' deck');
        bar.appendChild(sib);
      }
    }

    if (hasOverview()) {
      var ov = el('button', 'dsa-ov-btn');
      ov.type = 'button';
      ov.title = (track.title || 'Overview') + ' (O)';
      ov.setAttribute('aria-label', track.title || 'Overview');
      ov.appendChild(span('dsa-glyph', '▤'));
      ov.appendChild(span('dsa-label', 'Overview'));
      ov.addEventListener('click', function () { togglePanel('overview'); });
      bar.appendChild(ov);
    }

    themeBtn = el('button', 'dsa-theme');
    themeBtn.type = 'button';
    themeBtn.title = 'Colour theme — auto, light, dark (T)';
    themeBtn.addEventListener('click', cycleTheme);
    bar.appendChild(themeBtn);

    var help = el('button', 'dsa-help', '?');
    help.type = 'button';
    help.title = 'Keyboard shortcuts (?)';
    help.setAttribute('aria-label', 'Keyboard shortcuts');
    help.addEventListener('click', function () { togglePanel('help'); });
    bar.appendChild(help);

    return bar;
  }

  /* ---------------- panels ----------------
     Two dialogs -- the shortcut sheet and the overview -- and never
     both at once. Built the first time they are asked for.          */
  var panels = {};
  var openName = null;
  var lastFocus = null;

  function keyRow(dl, keys, what) {
    var dt = document.createElement('dt');
    String(keys).split(/\s+/).forEach(function (k) {
      var kbd = document.createElement('kbd');
      kbd.textContent = k;
      dt.appendChild(kbd);
    });
    var dd = document.createElement('dd');
    dd.textContent = what;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function buildHelp() {
    var o = el('div', 'dsa-overlay');
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-label', 'Keyboard shortcuts');

    var sheet = el('div', 'dsa-sheet');
    sheet.appendChild(el('h2', null, 'Keyboard shortcuts'));

    var pageKeys = Array.isArray(window.DSA_KEYS) ? window.DSA_KEYS : [];
    if (pageKeys.length) {
      sheet.appendChild(el('h3', null, 'This page'));
      var dlPage = el('dl', 'dsa-keys');
      pageKeys.forEach(function (row) { keyRow(dlPage, row[0], row[1]); });
      sheet.appendChild(dlPage);
    }

    sheet.appendChild(el('h3', null, 'Everywhere'));
    var dl = el('dl', 'dsa-keys');
    if (hasOverview()) {
      keyRow(dl, 'O M', track.unit === 'section'
        ? 'Jump to any section'
        : 'Overview — jump to any slide');
    }
    keyRow(dl, 'T', 'Cycle the colour theme: auto, light, dark');
    keyRow(dl, 'H', 'Back to the hub');
    keyRow(dl, '?', 'Open and close this list');
    keyRow(dl, 'Esc', 'Close whatever is open');
    sheet.appendChild(dl);

    sheet.appendChild(el('p', 'dsa-dismiss', 'Click anywhere outside to close.'));
    o.appendChild(sheet);
    o.addEventListener('click', function (e) { if (e.target === o) closePanel(); });
    return o;
  }

  function buildOverview() {
    var o = el('div', 'dsa-overlay dsa-overview');
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-label', track.title || 'Overview');

    var sheet = el('div', 'dsa-sheet dsa-sheet-wide');
    sheet.appendChild(el('h2', null, track.title || 'Overview'));
    sheet.appendChild(el('div', 'dsa-ov-body'));
    sheet.appendChild(el('p', 'dsa-dismiss', 'Click outside, or press Esc, to close.'));
    o.appendChild(sheet);
    o.addEventListener('click', function (e) { if (e.target === o) closePanel(); });
    return o;
  }

  /* Rebuilt on every open rather than kept in sync: thirty-odd buttons
     is nothing, and a list that is regenerated cannot drift from the
     page it describes. */
  function syncOverview() {
    var o = panels.overview;
    if (!o) return;
    var body = o.querySelector('.dsa-ov-body');
    var list = items(), cur = current();
    body.innerHTML = '';
    var group = null, grid = null;

    list.forEach(function (it, i) {
      var g = it.group || '';
      if (g !== group || !grid) {
        if (g) body.appendChild(el('div', 'dsa-ov-group', g));
        grid = el('div', 'dsa-ov-grid');
        body.appendChild(grid);
        group = g;
      }
      var b = el('button', 'dsa-ov-item');
      b.type = 'button';
      b.appendChild(span('dsa-ov-n', String(i + 1)));
      b.appendChild(span('dsa-ov-name', it.name || ''));
      if (i === cur) {
        b.classList.add('is-current');
        b.setAttribute('aria-current', 'true');
      }
      b.addEventListener('click', function () {
        closePanel();
        try { track.go(i); } catch (e) {}
      });
      grid.appendChild(b);
    });
  }

  function panelEl(name) {
    if (!panels[name]) {
      panels[name] = name === 'overview' ? buildOverview() : buildHelp();
      document.body.appendChild(panels[name]);
    }
    return panels[name];
  }

  function closePanel() {
    if (!openName) return;
    panels[openName].classList.remove('is-open');
    openName = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  function showPanel(name) {
    if (name === 'overview' && !hasOverview()) return;
    if (openName === name) return;
    if (openName) closePanel();
    lastFocus = document.activeElement;
    var p = panelEl(name);
    if (name === 'overview') syncOverview();
    p.classList.add('is-open');
    openName = name;
    /* Land on the slide you are already on, so Enter is a no-op and the
       arrows walk outward from where you are. */
    var focus = p.querySelector('.dsa-ov-item.is-current') || p.querySelector('.dsa-ov-item');
    if (focus) { try { focus.focus(); } catch (e) {} }
    if (name === 'overview' && focus && focus.scrollIntoView) {
      try { focus.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
  }

  function togglePanel(name, force) {
    var want = force == null ? openName !== name : !!force;
    if (want) showPanel(name); else closePanel();
  }

  /* Left/Up is back one, Right/Down is forward one. Not a true grid
     walk -- the rows are ragged because the groups are -- but it is
     predictable, which matters more than being clever. */
  function moveOvFocus(key) {
    var o = panels.overview;
    if (!o) return;
    var all = [].slice.call(o.querySelectorAll('.dsa-ov-item'));
    if (!all.length) return;
    var i = all.indexOf(document.activeElement);
    if (i < 0) i = 0;
    if (key === 'Home') i = 0;
    else if (key === 'End') i = all.length - 1;
    else if (key === 'ArrowLeft' || key === 'ArrowUp') i = Math.max(0, i - 1);
    else i = Math.min(all.length - 1, i + 1);
    try { all[i].focus(); all[i].scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }

  /* ---------------- the small-screen notice for fixed-stage labs ---------------- */
  function buildRotate() {
    var box = el('div', 'dsa-rotate');
    box.appendChild(span('dsa-rotate-icon', '↻'));
    box.appendChild(el('h2', null, 'This lab wants a wider screen'));
    box.appendChild(el('p', null,
      'It draws on a fixed 1280×720 stage, so on a narrow screen the labels end up ' +
      'smaller than the controls you are meant to click. Turn the phone sideways, or ' +
      'open it on a laptop.'));
    if (topic && topic.deck) {
      var a = document.createElement('a');
      a.href = topic.deck;
      a.textContent = 'Read the ' + topic.title + ' deck instead →';
      box.appendChild(a);
    }
    return box;
  }

  /* ---------------- keys ----------------
     Capture phase, so an open panel can swallow a key before the page's
     own handler sees it. With everything shut we touch only the keys we
     own and let the rest through untouched.                          */
  function typing(e) {
    var t = e.target;
    if (!t || !t.tagName) return false;
    var n = t.tagName;
    return n === 'INPUT' || n === 'SELECT' || n === 'TEXTAREA' || t.isContentEditable;
  }

  function isOverviewKey(k) { return k === 'o' || k === 'O' || k === 'm' || k === 'M'; }

  document.addEventListener('keydown', function (e) {
    var mod = e.metaKey || e.ctrlKey || e.altKey;

    /* With a panel up, nothing underneath should react: reading the
       shortcut list is not a reason to advance four slides. Modifier
       combos and Tab still go through, so the browser's own keys and
       focus movement keep working. */
    if (openName) {
      if (mod || e.key === 'Tab') return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); return; }

      if (openName === 'overview') {
        /* The items are real buttons, so Enter and Space are theirs. */
        if (e.key === 'Enter' || e.key === ' ') return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key.indexOf('Arrow') === 0 || e.key === 'Home' || e.key === 'End') moveOvFocus(e.key);
        else if (isOverviewKey(e.key) || e.key === '?') closePanel();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      if (e.key === '?' || e.key === 'Enter' || e.key === ' ') closePanel();
      return;
    }

    if (mod || typing(e)) return;
    if (e.key === '?') { e.preventDefault(); e.stopPropagation(); showPanel('help'); }
    else if (isOverviewKey(e.key) && hasOverview()) {
      e.preventDefault(); e.stopPropagation(); showPanel('overview');
    }
    else if (e.key === 't' || e.key === 'T') { e.preventDefault(); cycleTheme(); }
    else if ((e.key === 'h' || e.key === 'H') && kind !== 'hub') {
      e.preventDefault();
      location.href = 'index.html';
    }
  }, true);

  /* ---------------- boot ---------------- */
  mode = readTheme();

  document.body.insertBefore(buildBar(), document.body.firstChild);
  if (kind === 'lab' && topic && topic.desktop) {
    root.setAttribute('data-desktop', 'true');
    document.body.appendChild(buildRotate());
  }

  applyTheme(false);

  if (mq) {
    var onSystem = function () { if (mode === 'auto') applyTheme(false); };
    if (mq.addEventListener) mq.addEventListener('change', onSystem);
    else if (mq.addListener) mq.addListener(onSystem);
  }

  /* The page booted itself before this deferred script ran, so the first
     record of where the reader is has to come from here. */
  if (track) { syncHash(); writeProgress(); }

  window.DSAChrome = {
    cycleTheme: cycleTheme,
    setTheme: setTheme,
    getTheme: function () { return mode; },
    resolvedTheme: resolved,
    toggleShortcuts: function (force) { togglePanel('help', force); },
    toggleOverview: function (force) { togglePanel('overview', force); },
    closePanel: closePanel,
    moved: moved
  };
})();
