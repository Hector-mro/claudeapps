/* Coordonnées — échiquier, cases, pièces, maîtrise et tirage des cibles */
(function (global) {
  'use strict';

  var FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  var RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

  var ALL = [];                       // 64 cases, de a1 à h8
  FILES.forEach(function (f) {
    RANKS.forEach(function (r) { ALL.push(f + r); });
  });

  function fileIdx(sq) { return sq.charCodeAt(0) - 97; }   // a -> 0
  function rankIdx(sq) { return sq.charCodeAt(1) - 49; }   // 1 -> 0
  function isLight(sq) { return (fileIdx(sq) + rankIdx(sq)) % 2 === 1; }  // a1 est sombre

  /* Position de départ. On n'utilise que les glyphes pleins : la couleur des
     blancs est faite en CSS, ce qui évite les rendus incohérents d'un
     appareil à l'autre. ︎ force la présentation texte (jamais emoji). */
  var BACK = ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'];
  var PAWN = '♟';
  var START = {};
  FILES.forEach(function (f, i) {
    START[f + '1'] = { g: BACK[i], side: 'w' };
    START[f + '2'] = { g: PAWN, side: 'w' };
    START[f + '7'] = { g: PAWN, side: 'b' };
    START[f + '8'] = { g: BACK[i], side: 'b' };
  });

  /* Ordre d'affichage : vu des blancs, a8 en haut à gauche. */
  function orderFor(orientation) {
    var out = [];
    var files = orientation === 'black' ? FILES.slice().reverse() : FILES;
    var ranks = orientation === 'black' ? RANKS.slice() : RANKS.slice().reverse();
    ranks.forEach(function (r) {
      files.forEach(function (f) { out.push(f + r); });
    });
    return out;
  }

  /* ------------------------------------------------------------- rendu DOM */

  function build(el) {
    el.innerHTML = '';
    var map = {};
    ALL.forEach(function (sq) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sq ' + (isLight(sq) ? 'light' : 'dark');
      b.dataset.sq = sq;
      b.setAttribute('aria-label', 'case');   // surtout pas la coordonnée
      var p = document.createElement('span');
      p.className = 'piece';
      b.appendChild(p);
      el.appendChild(b);
      map[sq] = b;
    });
    el._squares = map;
    return map;
  }

  function layout(el, orientation) {
    var order = orderFor(orientation);
    order.forEach(function (sq, i) { el._squares[sq].style.order = i; });
    el.dataset.orientation = orientation;
  }

  function setPieces(el, on) {
    ALL.forEach(function (sq) {
      var span = el._squares[sq].firstChild;
      var p = on ? START[sq] : null;
      span.textContent = p ? p.g + '︎' : '';
      span.className = 'piece' + (p ? ' p-' + p.side : '');
    });
    el.classList.toggle('has-pieces', !!on);
  }

  function clearMarks(el) {
    ALL.forEach(function (sq) {
      el._squares[sq].classList.remove('target', 'good', 'bad');
    });
  }

  /* ------------------------------------------------------------- maîtrise */

  var FAST = 900, SLOW = 4200;   // bornes de la note de rapidité (ms)

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* Additionne les fiches d'une case sur un ou plusieurs exercices. */
  function record(squares, modes, sq) {
    var out = { ok: 0, err: 0, ms: 0, best: 0 };
    modes.forEach(function (m) {
      var r = squares[m] && squares[m][sq];
      if (!r) return;
      out.ok += r.ok; out.err += r.err; out.ms += r.ms;
      if (r.best && (!out.best || r.best < out.best)) out.best = r.best;
    });
    return out;
  }

  /* Note de 0 à 1, ramenée vers 0,5 tant que les essais sont peu nombreux.
     null = case jamais rencontrée. */
  function mastery(rec) {
    var n = rec.ok + rec.err;
    if (!n) return null;
    var acc = rec.ok / n;
    var avg = rec.ok ? rec.ms / rec.ok : SLOW;
    var speed = clamp((SLOW - avg) / (SLOW - FAST), 0, 1);
    var raw = 0.6 * acc + 0.4 * speed;
    var conf = n / (n + 3);
    return raw * conf + 0.5 * (1 - conf);
  }

  function avgMs(rec) { return rec.ok ? Math.round(rec.ms / rec.ok) : 0; }

  /* Poids de tirage en mode « cases faibles ». */
  function weight(m) {
    if (m === null) return 2.2;                       // jamais vue : à découvrir
    return 0.18 + 3.2 * Math.pow(1 - m, 1.7);
  }

  /* Tire une case. `avoid` évite de répéter la même deux fois de suite. */
  function pick(opts) {
    var pool = ALL.filter(function (sq) { return sq !== opts.avoid; });
    if (!opts.weak) return pool[Math.floor(Math.random() * pool.length)];

    var weights = pool.map(function (sq) {
      return weight(mastery(record(opts.squares, opts.modes, sq)));
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  global.CC = global.CC || {};
  global.CC.board = {
    FILES: FILES, RANKS: RANKS, ALL: ALL, START: START,
    isLight: isLight, orderFor: orderFor,
    build: build, layout: layout, setPieces: setPieces, clearMarks: clearMarks,
    record: record, mastery: mastery, avgMs: avgMs, weight: weight, pick: pick
  };
})(window);
