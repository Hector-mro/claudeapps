/* Undercover — persistance (localStorage) : réglages, joueurs, mots perso, stats */
(function (global) {
  'use strict';

  var KEY = 'undercover.fr.v1';

  var DEFAULT_SETTINGS = {
    // Rôles
    undercoverCount: 1,
    mrWhiteCount: 0,
    autoRoles: true,             // calcule les rôles selon le nombre de joueurs
    undercoverKnows: false,      // l'undercover sait qu'il est undercover
    // Mots
    wordLang: 'fr',              // 'fr' | 'en' | 'both'
    categories: null,            // null = toutes ; sinon tableau d'ids
    difficulties: [1, 2, 3],
    avoidRepeats: true,
    showCategory: false,         // affiche la catégorie pendant la partie (indice)
    customOnly: false,
    // Distribution
    holdToReveal: false,         // maintenir appuyé pour voir son mot
    shuffleRevealOrder: false,
    // Tour de parole
    randomFirstSpeaker: true,
    whiteNeverFirst: true,       // Mr White ne parle jamais en premier
    turnTimer: 0,                // secondes par joueur (0 = off)
    discussionTimer: 0,          // secondes de débat (0 = off)
    // Vote
    voteMode: 'quick',           // 'quick' | 'sequential'
    tieMode: 'revote',           // 'revote' | 'random' | 'nobody'
    revealEliminatedRole: true,
    allowPeek: false,            // revoir son mot pendant la manche
    // Mr White
    whiteCanGuess: true,
    whiteGuessOnlyIfLast: false,
    // Score
    scoring: true,
    pointsCivil: 2,
    pointsUndercover: 6,
    pointsWhite: 8,
    pointsWhiteGuess: 4,
    targetScore: 0,              // 0 = pas de limite
    // Confort
    sound: true,
    vibration: true,
    theme: 'light',   // 'light' = papier, 'dark' = encre de nuit
    keepAwake: true
  };

  var DEFAULT_DATA = {
    settings: DEFAULT_SETTINGS,
    players: [],       // [{id, name, emoji}]
    customPairs: [],   // [{id, a, b, cat:'custom', diff}]
    usedPairs: [],     // ids déjà tirés
    scores: {},        // playerId -> points (partie en cours)
    stats: {
      games: 0, rounds: 0,
      civilWins: 0, undercoverWins: 0, whiteWins: 0,
      byPlayer: {}     // name -> {rounds, wins, asUndercover, asWhite, undercoverWins, whiteWins}
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function merge(base, over) {
    var out = clone(base);
    if (!over) return out;
    Object.keys(over).forEach(function (k) {
      if (over[k] !== undefined && over[k] !== null && !Array.isArray(over[k]) &&
          typeof over[k] === 'object' && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = merge(out[k], over[k]);
      } else if (over[k] !== undefined) {
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
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* quota / mode privé : on ignore */ }
  }

  function reset() {
    data = clone(DEFAULT_DATA);
    save();
  }

  global.UC = global.UC || {};
  global.UC.store = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    load: load,
    save: save,
    reset: reset,
    get data() { return data; },
    get settings() { return data.settings; }
  };
})(window);
