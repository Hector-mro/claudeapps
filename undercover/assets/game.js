/* Undercover — moteur de jeu (indépendant de l'interface) */
(function (global) {
  'use strict';

  var ROLE = { CIVIL: 'civil', UNDERCOVER: 'undercover', WHITE: 'white' };

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /* Répartition conseillée des rôles selon le nombre de joueurs */
  function suggestRoles(n) {
    if (n <= 4)  return { undercover: 1, white: 0 };
    if (n <= 6)  return { undercover: 1, white: 1 };
    if (n <= 10) return { undercover: 2, white: 1 };
    if (n <= 12) return { undercover: 3, white: 1 };
    if (n <= 14) return { undercover: 3, white: 2 };
    if (n <= 18) return { undercover: 4, white: 2 };
    return { undercover: 5, white: 2 };
  }

  function validateSetup(playerCount, undercover, white) {
    if (playerCount < 3) return 'Il faut au moins 3 joueurs.';
    var imposteurs = undercover + white;
    if (imposteurs < 1) return 'Il faut au moins un undercover ou un Mr White.';
    if (playerCount - imposteurs < 2) return 'Il faut au moins 2 civils.';
    if (imposteurs >= playerCount - imposteurs) return 'Les imposteurs ne peuvent pas être aussi nombreux que les civils.';
    return null;
  }

  /* Pool de paires filtré par catégories / difficulté / historique */
  function buildPool(settings, customPairs, usedPairs) {
    var all = (settings.customOnly ? [] : global.UC.PAIRS).concat(customPairs || []);
    var cats = settings.categories;
    var diffs = settings.difficulties && settings.difficulties.length ? settings.difficulties : [1, 2, 3];

    var pool = all.filter(function (p) {
      if (cats && cats.length && cats.indexOf(p.cat) === -1) return false;
      if (p.cat !== 'custom' && diffs.indexOf(p.diff) === -1) return false;
      return true;
    });

    if (settings.avoidRepeats && usedPairs && usedPairs.length) {
      var fresh = pool.filter(function (p) { return usedPairs.indexOf(p.id) === -1; });
      if (fresh.length) return { pool: fresh, exhausted: false };
      return { pool: pool, exhausted: true }; // toutes vues : on repart de zéro
    }
    return { pool: pool, exhausted: false };
  }

  function Game() {
    this.players = [];
    this.settings = null;
    this.roundIndex = 0;
    this.round = null;
    this.scores = {};
    this.history = [];   // résumé des manches jouées
  }

  Game.prototype.start = function (players, settings) {
    this.players = players.slice();
    this.settings = settings;
    this.roundIndex = 0;
    this.round = null;
    this.scores = {};
    this.history = [];
    var self = this;
    players.forEach(function (p) { self.scores[p.id] = 0; });
  };

  /* Crée une nouvelle manche. onPairUsed(pairId, exhausted) permet de tenir l'historique. */
  Game.prototype.newRound = function (pairSource, onPairUsed) {
    var s = this.settings;
    var res = pairSource();
    if (!res.pool.length) return null;
    if (res.exhausted && onPairUsed) onPairUsed(null, true);

    var pair = pick(res.pool);
    if (onPairUsed) onPairUsed(pair.id, false);

    // Tirage : n'importe lequel des deux mots peut être celui des civils
    var flip = Math.random() < 0.5;
    var civilWord = flip ? pair.a : pair.b;
    var undercoverWord = flip ? pair.b : pair.a;

    var order = shuffle(this.players);
    var roles = [];
    var i;
    for (i = 0; i < s.undercoverCount; i++) roles.push(ROLE.UNDERCOVER);
    for (i = 0; i < s.mrWhiteCount; i++) roles.push(ROLE.WHITE);
    while (roles.length < order.length) roles.push(ROLE.CIVIL);
    roles = shuffle(roles);

    var members = order.map(function (p, idx) {
      var role = roles[idx];
      return {
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        role: role,
        word: role === ROLE.CIVIL ? civilWord : (role === ROLE.UNDERCOVER ? undercoverWord : null),
        alive: true,
        eliminatedTurn: null
      };
    });

    // Ordre de passage fixe (circulaire), premier orateur tiré au sort
    var baseOrder = s.randomFirstSpeaker ? shuffle(members).map(function (m) { return m.id; })
                                         : members.map(function (m) { return m.id; });
    var first = 0;
    if (s.whiteNeverFirst) {
      for (var k = 0; k < baseOrder.length; k++) {
        var m = members.filter(function (x) { return x.id === baseOrder[k]; })[0];
        if (m.role !== ROLE.WHITE) { first = k; break; }
      }
    }

    this.roundIndex++;
    this.round = {
      index: this.roundIndex,
      pair: pair,
      civilWord: civilWord,
      undercoverWord: undercoverWord,
      members: members,
      revealOrder: (s.shuffleRevealOrder ? shuffle(members) : members).map(function (m) { return m.id; }),
      baseOrder: baseOrder,
      firstIdx: first,
      turn: 1,
      votes: {},
      lastElimination: null,
      whiteGuess: null,
      over: false,
      winner: null,
      awarded: null
    };
    return this.round;
  };

  Game.prototype.member = function (id) {
    var r = this.round;
    for (var i = 0; i < r.members.length; i++) if (r.members[i].id === id) return r.members[i];
    return null;
  };

  Game.prototype.alive = function () {
    return this.round.members.filter(function (m) { return m.alive; });
  };

  /* Ordre de parole du tour courant (vivants seulement, en cercle) */
  Game.prototype.speakingOrder = function () {
    var r = this.round, out = [], n = r.baseOrder.length;
    for (var i = 0; i < n; i++) {
      var m = this.member(r.baseOrder[(r.firstIdx + i) % n]);
      if (m && m.alive) out.push(m);
    }
    return out;
  };

  Game.prototype.counts = function () {
    var a = this.alive();
    return {
      civils: a.filter(function (m) { return m.role === ROLE.CIVIL; }).length,
      undercover: a.filter(function (m) { return m.role === ROLE.UNDERCOVER; }).length,
      white: a.filter(function (m) { return m.role === ROLE.WHITE; }).length,
      total: a.length
    };
  };

  Game.prototype.tally = function () {
    var counts = {}, r = this.round;
    Object.keys(r.votes).forEach(function (voter) {
      var t = r.votes[voter];
      if (!t) return;
      counts[t] = (counts[t] || 0) + 1;
    });
    var max = 0;
    Object.keys(counts).forEach(function (id) { if (counts[id] > max) max = counts[id]; });
    var top = Object.keys(counts).filter(function (id) { return counts[id] === max; });
    return { counts: counts, max: max, top: top, tie: top.length > 1 };
  };

  Game.prototype.eliminate = function (playerId) {
    var m = this.member(playerId);
    if (!m || !m.alive) return null;
    m.alive = false;
    m.eliminatedTurn = this.round.turn;
    this.round.lastElimination = m;
    return m;
  };

  /* Vérifie la fin de manche. Renvoie 'civils' | 'imposteurs' | null */
  Game.prototype.checkEnd = function () {
    var c = this.counts();
    var imposteurs = c.undercover + c.white;
    if (imposteurs === 0) return 'civils';
    if (imposteurs >= c.civils) return 'imposteurs';
    return null;
  };

  Game.prototype.nextTurn = function () {
    var r = this.round, n = r.baseOrder.length;
    // Le premier orateur passe au vivant suivant
    for (var i = 1; i <= n; i++) {
      var idx = (r.firstIdx + i) % n;
      var m = this.member(r.baseOrder[idx]);
      if (m && m.alive) { r.firstIdx = idx; break; }
    }
    r.turn++;
    r.votes = {};
  };

  Game.prototype.submitWhiteGuess = function (text) {
    var ok = normalize(text) === normalize(this.round.civilWord);
    this.round.whiteGuess = { text: text, correct: ok };
    return ok;
  };

  /* Termine la manche et attribue les points */
  Game.prototype.endRound = function (winner) {
    var s = this.settings, r = this.round, self = this;
    r.over = true;
    r.winner = winner; // 'civils' | 'imposteurs' | 'white'
    var awarded = {};

    function give(id, pts) { awarded[id] = (awarded[id] || 0) + pts; self.scores[id] = (self.scores[id] || 0) + pts; }

    if (s.scoring) {
      r.members.forEach(function (m) {
        if (winner === 'civils' && m.role === ROLE.CIVIL) give(m.id, s.pointsCivil);
        // côté imposteurs, seuls les survivants marquent : être démasqué coûte cher
        if (winner === 'imposteurs' && m.alive) {
          if (m.role === ROLE.UNDERCOVER) give(m.id, s.pointsUndercover);
          if (m.role === ROLE.WHITE) give(m.id, s.pointsWhite);
        }
        if (winner === 'white' && m.role === ROLE.WHITE) give(m.id, s.pointsWhite + s.pointsWhiteGuess);
      });
    }
    r.awarded = awarded;

    this.history.push({
      index: r.index,
      civilWord: r.civilWord,
      undercoverWord: r.undercoverWord,
      winner: winner,
      members: r.members.map(function (m) { return { name: m.name, role: m.role, alive: m.alive }; })
    });
    return awarded;
  };

  Game.prototype.leaderboard = function () {
    var self = this;
    return this.players.map(function (p) {
      return { id: p.id, name: p.name, emoji: p.emoji, score: self.scores[p.id] || 0 };
    }).sort(function (a, b) { return b.score - a.score; });
  };

  Game.prototype.targetReached = function () {
    var t = this.settings.targetScore;
    if (!t) return false;
    var lb = this.leaderboard();
    return lb.length > 0 && lb[0].score >= t;
  };

  global.UC = global.UC || {};
  global.UC.ROLE = ROLE;
  global.UC.Game = Game;
  global.UC.util = {
    shuffle: shuffle, pick: pick, normalize: normalize,
    suggestRoles: suggestRoles, validateSetup: validateSetup, buildPool: buildPool
  };
})(window);
