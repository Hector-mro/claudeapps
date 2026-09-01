/* Coordonnées — persistance (localStorage) : réglages, statistiques par case, historique */
(function (global) {
  'use strict';

  var KEY = 'chesscoords.fr.v1';

  var DEFAULT_SETTINGS = {
    // Série
    duration: 60,            // secondes
    penalty: 3,              // secondes retirées à chaque erreur
    penaltyPoint: false,     // l'erreur retire aussi un point
    weakMode: false,         // tirage orienté vers les cases mal maîtrisées
    // Échiquier
    orientation: 'random',   // 'white' | 'black' | 'random' (côté au départ)
    flip: 'off',             // 'off' | '3' | '5' | '10' | 'random'
    pieces: true,            // pièces en position de départ
    // Échiquier de référence (hors exercice)
    view: {
      orientation: 'white',
      coords: true,      // lettres et chiffres en bordure
      pieces: true,      // position de départ
      guides: true,      // ligne et colonne de la case touchée
      heat: false        // maîtrise superposée
    },
    // Confort
    keypad: true,
    sound: true,
    vibration: true,
    theme: 'light',          // 'light' = papier, 'dark' = encre de nuit
    keepAwake: true
  };

  // squares : nom de case -> { ok, err, conf, ms, best }
  //   ok   = cases validées
  //   err  = fautes commises alors que cette case était demandée
  //   conf = fois où elle a été désignée à la place de la case demandée
  //   ms   = temps cumulé (ms) des résolutions   best = meilleur temps (ms)
  var DEFAULT_DATA = {
    settings: DEFAULT_SETTINGS,
    stats: {
      series: 0,
      solved: 0,
      errors: 0,
      playedMs: 0,
      bestScore: { find: 0, name: 0, color: 0 },
      bestStreak: 0,
      squares: { find: {}, name: {}, color: {} }
    },
    history: []   // [{t, mode, score, errors, duration, weak, avgMs}] — 24 dernières
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function merge(base, over) {
    var out = clone(base);
    if (!over) return out;
    Object.keys(over).forEach(function (k) {
      if (over[k] === undefined) return;
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
          out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = merge(out[k], over[k]);
      } else {
        out[k] = over[k];
      }
    });
    return out;
  }

  var data = clone(DEFAULT_DATA);

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) data = merge(DEFAULT_DATA, JSON.parse(raw));
    } catch (e) {
      data = clone(DEFAULT_DATA);
    }
    return data;
  }

  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { /* quota / navigation privée : on ignore */ }
  }

  function resetAll() { data = clone(DEFAULT_DATA); save(); }

  function resetStats() {
    data.stats = clone(DEFAULT_DATA.stats);
    data.history = [];
    save();
  }

  /* Fiche d'une case pour un exercice donné, créée à la volée. */
  function square(mode, sq) {
    var box = data.stats.squares[mode] || (data.stats.squares[mode] = {});
    return box[sq] || (box[sq] = { ok: 0, err: 0, conf: 0, ms: 0, best: 0 });
  }

  function pushHistory(entry) {
    data.history.unshift(entry);
    if (data.history.length > 24) data.history.length = 24;
  }

  global.CC = global.CC || {};
  global.CC.store = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    load: load,
    save: save,
    resetAll: resetAll,
    resetStats: resetStats,
    square: square,
    pushHistory: pushHistory,
    get data() { return data; },
    get settings() { return data.settings; },
    get stats() { return data.stats; }
  };
})(window);
