/* ============================================================
   shared/catalog.js — the one list of what exists.

   Read by three very different consumers, which is why it is a
   plain classic script hanging things off `self` rather than a
   module:
     index.html    renders the cards and the header stats
     python.html   the same, for its own track
     shared/chrome.js  breadcrumb, sibling link, desktop badge
     sw.js         precache list, via importScripts()

   Adding a module means adding one entry here. Nothing else in
   the app keeps a second copy of this list.

   Tracks
     A track is a subject area with its own hub page. `dsa` is the
     original one and its hub is the front door; `python` sits
     beside it. A topic belongs to exactly one track, and the hub
     of a track shows only its own topics -- which is the whole
     reason the field exists, since a list of every page in the app
     stopped being a useful front door at about eleven entries.

     id       matches a [data-topic] hue in shared/tokens.css, and
              the data-topic attribute on that track's hub page
     title    display name, used on the bar and on the track card
     hub      the page that lists this track's topics
     root     true for the one hub that is also the site front door
     blurb    one line for the track card on another track's hub

   Fields on a topic
     id       matches the [data-topic] hue in shared/tokens.css
              and the data-topic attribute on the pages below
     track    which hub lists it; defaults to 'dsa' when absent
     title    display name, used in breadcrumbs and on cards
     blurb    one line for the hub card
     icon     id of a <g> in that hub's inline <defs> sprite
     deck     file for the explainer, if the topic has one
     lab      file for the interactive lab, if the topic has one
     desktop  true for the fixed-stage labs, which do not reflow
              below ~760px and say so instead of pretending
   ============================================================ */
(function (root) {
  'use strict';

  var TRACKS = [
    {
      id: 'dsa',
      title: 'Data Structures & Algorithms',
      short: 'DSA',
      hub: 'index.html',
      root: true,
      icon: 'i-dsa',
      blurb: 'Trees, sorts, hashing and graphs, argued from the problem up.'
    },
    {
      id: 'python',
      title: 'Python',
      short: 'Python',
      hub: 'python.html',
      icon: 'i-python',
      blurb: 'The language up close: the object model, and the rules that explain its behaviour.'
    }
  ];

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
    },
    {
      id: 'python-oop',
      track: 'python',
      title: 'Python OOP',
      blurb: 'One lookup rule behind every class, property, mixin and metaclass.',
      icon: 'i-class',
      deck: 'python-oop.html'
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

  var DEFAULT_TRACK = 'dsa';

  function byId(id) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return TOPICS[i];
    return null;
  }

  function trackById(id) {
    for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i];
    return null;
  }

  function rootTrack() {
    for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].root) return TRACKS[i];
    return TRACKS[0];
  }

  /* A topic without a `track` is a DSA topic: the eleven that predate
     tracks say nothing, and adding the field to all of them would have
     been eleven chances to typo the same string. */
  function trackIdOf(topic) {
    return (topic && topic.track) || DEFAULT_TRACK;
  }

  function trackOf(topic) {
    return trackById(trackIdOf(topic)) || rootTrack();
  }

  function inTrack(trackId) {
    return TOPICS.filter(function (t) { return trackIdOf(t) === trackId; });
  }

  /* Where the chrome bar's home link and the H key should land from a
     given page. A topic page goes to its own track's hub; a track hub
     goes up to the front door. */
  function hubFor(topic) {
    return trackOf(topic).hub;
  }

  /* Every local page this app owns: the hubs first, then the modules. */
  function pages() {
    var out = TRACKS.map(function (tr) { return tr.hub; });
    TOPICS.forEach(function (t) {
      if (t.deck) out.push(t.deck);
      if (t.lab) out.push(t.lab);
    });
    return out;
  }

  function count(kind, trackId) {
    return TOPICS.filter(function (t) {
      return t[kind] && (!trackId || trackIdOf(t) === trackId);
    }).length;
  }

  root.DSA_CATALOG = {
    topics: TOPICS,
    tracks: TRACKS,
    byId: byId,
    trackById: trackById,
    trackIdOf: trackIdOf,
    trackOf: trackOf,
    rootTrack: rootTrack,
    inTrack: inTrack,
    hubFor: hubFor,
    pages: pages,
    shared: SHARED,
    icons: ICONS,
    fonts: FONTS,
    decks: function (trackId) { return count('deck', trackId); },
    labs: function (trackId) { return count('lab', trackId); },
    modules: function (trackId) { return count('deck', trackId) + count('lab', trackId); }
  };
})(typeof self !== 'undefined' ? self : this);
