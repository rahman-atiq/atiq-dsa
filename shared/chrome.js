/* ============================================================
   shared/chrome.js — the top bar, the theme, the `?` overlay.

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
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var topicId = root.getAttribute('data-topic') || '';
  var kind = root.getAttribute('data-kind') || '';
  var catalog = window.DSA_CATALOG || null;
  var topic = (catalog && catalog.byId(topicId)) || null;

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

    themeBtn = el('button', 'dsa-theme');
    themeBtn.type = 'button';
    themeBtn.title = 'Colour theme — auto, light, dark (T)';
    themeBtn.addEventListener('click', cycleTheme);
    bar.appendChild(themeBtn);

    var help = el('button', 'dsa-help', '?');
    help.type = 'button';
    help.title = 'Keyboard shortcuts (?)';
    help.setAttribute('aria-label', 'Keyboard shortcuts');
    help.addEventListener('click', function () { toggleOverlay(); });
    bar.appendChild(help);

    return bar;
  }

  /* ---------------- shortcut overlay ---------------- */
  var overlay = null;

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

  function buildOverlay() {
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
    keyRow(dl, 'T', 'Cycle the colour theme: auto, light, dark');
    keyRow(dl, 'H', 'Back to the hub');
    keyRow(dl, '?', 'Open and close this list');
    keyRow(dl, 'Esc', 'Close this list');
    sheet.appendChild(dl);

    sheet.appendChild(el('p', 'dsa-dismiss', 'Click anywhere outside to close.'));
    o.appendChild(sheet);
    o.addEventListener('click', function (e) { if (e.target === o) toggleOverlay(false); });
    return o;
  }

  function overlayOpen() { return !!overlay && overlay.classList.contains('is-open'); }

  function toggleOverlay(force) {
    if (!overlay) { overlay = buildOverlay(); document.body.appendChild(overlay); }
    var open = force == null ? !overlayOpen() : !!force;
    overlay.classList.toggle('is-open', open);
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
     Capture phase, so the overlay can swallow a key before the page's
     own handler sees it. When the overlay is shut we touch only the
     three keys we own and let everything else through untouched.   */
  function typing(e) {
    var t = e.target;
    if (!t || !t.tagName) return false;
    var n = t.tagName;
    return n === 'INPUT' || n === 'SELECT' || n === 'TEXTAREA' || t.isContentEditable;
  }

  document.addEventListener('keydown', function (e) {
    var mod = e.metaKey || e.ctrlKey || e.altKey;

    /* With the overlay up, nothing underneath should react: reading the
       shortcut list is not a reason to advance four slides. Modifier
       combos and Tab still go through, so the browser's own keys and
       focus movement keep working. */
    if (overlayOpen()) {
      if (mod || e.key === 'Tab') return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape' || e.key === '?' || e.key === 'Enter' || e.key === ' ') {
        toggleOverlay(false);
      }
      return;
    }
    if (mod || typing(e)) return;
    if (e.key === '?') { e.preventDefault(); e.stopPropagation(); toggleOverlay(true); }
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

  window.DSAChrome = {
    cycleTheme: cycleTheme,
    setTheme: setTheme,
    getTheme: function () { return mode; },
    resolvedTheme: resolved,
    toggleShortcuts: toggleOverlay
  };
})();
