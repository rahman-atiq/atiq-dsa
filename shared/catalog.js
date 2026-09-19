/* ============================================================
   shared/catalog.js — the one list of what exists.

   Read by three very different consumers, which is why it is a
   plain classic script hanging things off `self` rather than a
   module:
     index.html    renders the cards and the header stats
     shared/chrome.js  breadcrumb, sibling link, desktop badge
     sw.js         precache list, via importScripts()

   Adding a module means adding one entry here. Nothing else in
   the app keeps a second copy of this list.

   Fields
     id       matches the [data-topic] hue in shared/tokens.css
              and the data-topic attribute on the pages below
     title    display name, used in breadcrumbs and on cards
     blurb    one line for the hub card
     icon     id of a <g> in the hub's inline <defs> sprite
     deck     file for the explainer, if the topic has one
     lab      file for the interactive lab, if the topic has one
     desktop  true for the fixed-stage labs, which do not reflow
              below ~760px and say so instead of pretending
   ============================================================ */
(function (root) {
  'use strict';

  var TOPICS = [
    {
      id: 'recursion',
      title: 'Recursion',
      blurb: 'Base cases, the call stack, and learning to trust the recursive leap.',
      icon: 'i-recursion',
      deck: 'recursion.html'
    },
    {
      id: 'linked-lists',
      title: 'Linked Lists',
      blurb: 'Pointer surgery, one link at a time, with nothing hidden.',
      icon: 'i-list',
      lab: 'LinkedListLab.html'
    },
    {
      id: 'binary-trees',
      title: 'Binary Trees',
      blurb: 'Traversals, search trees, and what happens when order goes wrong.',
      icon: 'i-binary',
      deck: 'binary-trees.html',
      lab: 'BinaryTreeLab.html'
    },
    {
      id: 'avl-trees',
      title: 'AVL Trees',
      blurb: 'Height balance, four rotation cases, and a hard O(log n) guarantee.',
      icon: 'i-avl',
      deck: 'avl-trees.html',
      lab: 'AVLTreeLab.html',
      desktop: true
    },
    {
      id: 'red-black-trees',
      title: 'Red-Black Trees',
      blurb: 'Five colour rules that keep a tree honest without obsessing over height.',
      icon: 'i-rb',
      deck: 'red-black-trees.html',
      lab: 'RedBlackTreeLab.html',
      desktop: true
    },
    {
      id: 'b-trees',
      title: 'B-Trees',
      blurb: 'Wide nodes, shallow depth, and why disks and caches demand both.',
      icon: 'i-btree',
      deck: 'b-trees.html',
      lab: 'BTreeLab.html',
      desktop: true
    },
    {
      id: 'heap-sort',
      title: 'Heap Sort',
      blurb: "An array that thinks it's a tree: sift, swap, and sort in place.",
      icon: 'i-heap',
      deck: 'heap-sort.html',
      lab: 'HeapSortLab.html',
      desktop: true
    },
    {
      id: 'sorting',
      title: 'Sorting',
      blurb: 'Race the classic sorts on the same data and count the real work.',
      icon: 'i-sort',
      lab: 'SortingLab.html'
    },
    {
      id: 'hashing',
      title: 'Hashing',
      blurb: 'Buckets, collisions, load factors, and the cost of a bad hash function.',
      icon: 'i-hash',
      deck: 'hashing.html'
    },
    {
      id: 'graphs',
      title: 'Graphs',
      blurb: 'Representations, BFS and DFS, and the paths that fall out of them.',
      icon: 'i-graph',
      deck: 'graphs.html'
    },
    {
      id: 'memory',
      title: 'Memory',
      blurb: 'Cache lines, locality, and why the constant factor wins arguments.',
      icon: 'i-memory',
      lab: 'MemoryLab.html'
    }
  ];


  /* Everything that is not a page but still has to be on disk for the app
     to work offline. sw.js reads these so its precache list is never a
     second, quietly diverging copy of the file tree. */
  var SHARED = [
    'shared/tokens.css',
    'shared/chrome.css',
    'shared/catalog.js',
    'shared/chrome.js'
  ];

  var ICONS = [
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-512-maskable.png',
    'icons/apple-touch-icon.png',
    'icons/favicon-32.png',
    'icons/favicon-16.png'
  ];

  /* Latin, latin-ext and greek per face. The @font-face rules carry
     unicode-range, so a browser still downloads only what a page needs --
     these are precached so that choice also works with no network. */
  var FONTS = [
    'fonts/jetbrains-mono-400-greek.woff2',
    'fonts/jetbrains-mono-400-latin-ext.woff2',
    'fonts/jetbrains-mono-400-latin.woff2',
    'fonts/jetbrains-mono-500-greek.woff2',
    'fonts/jetbrains-mono-500-latin-ext.woff2',
    'fonts/jetbrains-mono-500-latin.woff2',
    'fonts/jetbrains-mono-700-greek.woff2',
    'fonts/jetbrains-mono-700-latin-ext.woff2',
    'fonts/jetbrains-mono-700-latin.woff2',
    'fonts/spectral-400-latin-ext.woff2',
    'fonts/spectral-400-latin.woff2',
    'fonts/spectral-400i-latin-ext.woff2',
    'fonts/spectral-400i-latin.woff2',
    'fonts/spectral-500-latin-ext.woff2',
    'fonts/spectral-500-latin.woff2',
    'fonts/spectral-600-latin-ext.woff2',
    'fonts/spectral-600-latin.woff2',
    'fonts/spectral-700-latin-ext.woff2',
    'fonts/spectral-700-latin.woff2'
  ];

  function byId(id) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return TOPICS[i];
    return null;
  }

  /* Every local page this app owns, hub first. */
  function pages() {
    var out = ['index.html'];
    TOPICS.forEach(function (t) {
      if (t.deck) out.push(t.deck);
      if (t.lab) out.push(t.lab);
    });
    return out;
  }

  function count(kind) {
    return TOPICS.filter(function (t) { return t[kind]; }).length;
  }

  root.DSA_CATALOG = {
    topics: TOPICS,
    byId: byId,
    pages: pages,
    shared: SHARED,
    icons: ICONS,
    fonts: FONTS,
    decks: function () { return count('deck'); },
    labs: function () { return count('lab'); },
    modules: function () { return count('deck') + count('lab'); }
  };
})(typeof self !== 'undefined' ? self : this);
