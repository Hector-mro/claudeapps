/* Finales — accès aux tablebases Syzygy 7 pièces via l'API publique Lichess.

   Une seule requête par position, mémorisée en mémoire puis dans
   localStorage : rejouer un exercice devient instantané et ne retouche pas le
   réseau. Les requêtes sortantes sont sérialisées et espacées — l'API est
   publique et gratuite, on ne la martèle pas.

   `category` est toujours rendue du point de vue du camp au trait. La
   conversion vers le repère d'un camp donné passe par `pour()`. */
(function (global) {
  'use strict';

  var URL_API = 'https://tablebase.lichess.ovh/standard';
  /* 250 ms : en dessous, l'API publique finit par répondre 429 sur une série
     soutenue (constaté en vérifiant le générateur de coups). Le cache absorbe
     de toute façon les parties rejouées. */
  var DELAI = 250;
  var REPRISES_429 = 3;
  var CLE_STOCKAGE = 'finales.tb.v1';
  var MAX_STOCKEES = 4000;

  var INVERSE = {
    'win': 'loss', 'loss': 'win',
    'cursed-win': 'blessed-loss', 'blessed-loss': 'cursed-win',
    'maybe-win': 'maybe-loss', 'maybe-loss': 'maybe-win',
    'syzygy-win': 'syzygy-loss', 'syzygy-loss': 'syzygy-win',
    'draw': 'draw', 'unknown': 'unknown'
  };

  /* Trois classes lisibles, pour la frise et les comparaisons d'objectif.
     Les catégories « maudites » (résultat qui ne tient que par la règle des
     50 coups) sont rangées du côté qu'elles servent, mais restent
     identifiables via `souche()`. */
  function classe(cat) {
    if (cat === 'win' || cat === 'syzygy-win' || cat === 'maybe-win' || cat === 'cursed-win') return 'gain';
    if (cat === 'loss' || cat === 'syzygy-loss' || cat === 'maybe-loss' || cat === 'blessed-loss') return 'perte';
    return 'nulle';
  }
  function sousRegle50(cat) { return cat === 'cursed-win' || cat === 'blessed-loss'; }
  function inverse(cat) { return INVERSE[cat] || 'unknown'; }

  /* Catégorie vue par `camp` ('w'/'b'), sachant qu'elle est donnée pour
     `trait`. C'est la conversion que la validation impose et que la boucle de
     jeu doit faire avant toute comparaison à l'objectif. */
  function pour(cat, trait, camp) {
    return trait === camp ? cat : inverse(cat);
  }

  /* ------------------------------------------------------------- stockage */

  var memoire = Object.create(null);
  var enVol = Object.create(null);
  var persistant = null;
  var sale = false;

  function charger() {
    if (persistant) return persistant;
    persistant = Object.create(null);
    try {
      var brut = global.localStorage && global.localStorage.getItem(CLE_STOCKAGE);
      if (brut) persistant = JSON.parse(brut) || Object.create(null);
    } catch (e) { persistant = Object.create(null); }
    return persistant;
  }

  function ecrireBientot() {
    if (sale) return;
    sale = true;
    setTimeout(function () {
      sale = false;
      try {
        var p = charger();
        var cles = Object.keys(p);
        if (cles.length > MAX_STOCKEES) {
          // purge grossière : on garde la moitié la plus récemment écrite
          var garde = cles.slice(cles.length - Math.floor(MAX_STOCKEES / 2));
          var reduit = Object.create(null);
          garde.forEach(function (k) { reduit[k] = p[k]; });
          persistant = p = reduit;
        }
        global.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(p));
      } catch (e) { /* quota plein ou stockage indisponible : tant pis */ }
    }, 800);
  }

  /* Forme compacte : on ne garde que ce dont l'app se sert. */
  function compacter(data) {
    return {
      c: data.category,
      z: data.dtz === undefined ? null : data.dtz,
      m: data.dtm === undefined ? null : data.dtm,
      s: !!data.stalemate,
      k: !!data.checkmate,
      v: (data.moves || []).map(function (m) {
        return { u: m.uci, s: m.san, c: m.category, z: m.dtz === undefined ? null : m.dtz, m: m.dtm === undefined ? null : m.dtm };
      })
    };
  }

  function deplier(c) {
    return {
      category: c.c,
      dtz: c.z,
      dtm: c.m,
      stalemate: c.s,
      checkmate: c.k,
      /* `ordre` conserve le rang donné par l'API, qui classe les coups du
         meilleur au pire pour le camp au trait. C'est un tri de confiance :
         il tient compte du fait qu'un coup « zéroïsant » (prise, poussée de
         pion) remet le compteur DTZ à zéro, et qu'on ne peut donc pas
         comparer bêtement les DTZ de part et d'autre. */
      moves: c.v.map(function (m, i) {
        return { uci: m.u, san: m.s, category: m.c, dtz: m.z, dtm: m.m, ordre: i };
      })
    };
  }

  /* ---------------------------------------------------------------- réseau */

  var file = Promise.resolve();
  var etat = { enLigne: true, enCours: 0 };
  var auditeurs = [];

  function prevenir() {
    auditeurs.forEach(function (f) {
      try { f(etat); } catch (e) { /* un auditeur cassé n'arrête pas le jeu */ }
    });
  }

  function surEtat(f) { auditeurs.push(f); f(etat); }

  /* Une requête, avec reprise exponentielle sur 429 (limite de débit) —
     les autres codes d'erreur ne sont pas réessayés. */
  function requete(fen, essai, pause) {
    essai = essai || 0;
    pause = pause || 1200;
    return fetch(URL_API + '?fen=' + encodeURIComponent(fen), { mode: 'cors' })
      .then(function (r) {
        if (r.status === 429 && essai < REPRISES_429) {
          return new Promise(function (res) { setTimeout(res, pause); })
            .then(function () { return requete(fen, essai + 1, pause * 2); });
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  /* Interroge la tablebase. Retourne toujours une promesse ; rejette si la
     position est hors de portée ou si le réseau tombe — l'appelant décide
     quoi en faire, on ne devine jamais un résultat. */
  function probe(fen) {
    if (memoire[fen]) return Promise.resolve(memoire[fen]);

    var p = charger();
    if (p[fen]) {
      memoire[fen] = deplier(p[fen]);
      return Promise.resolve(memoire[fen]);
    }
    if (enVol[fen]) return enVol[fen];

    etat.enCours++;
    prevenir();

    var promesse = file.then(function () {
      return new Promise(function (r) { setTimeout(r, DELAI); });
    }).then(function () {
      return requete(fen);
    }).then(function (data) {
      if (!data || !(data.category in INVERSE)) {
        throw new Error('réponse inattendue de la tablebase');
      }
      var compact = compacter(data);
      memoire[fen] = deplier(compact);
      charger()[fen] = compact;
      ecrireBientot();
      if (!etat.enLigne) { etat.enLigne = true; }
      return memoire[fen];
    }).catch(function (e) {
      etat.enLigne = false;
      throw e;
    }).finally(function () {
      etat.enCours--;
      delete enVol[fen];
      prevenir();
    });

    file = promesse.catch(function () { /* la file continue malgré l'échec */ });
    enVol[fen] = promesse;
    return promesse;
  }

  /* Précharge sans bloquer ni propager l'erreur. */
  function prechauffer(fens) {
    fens.forEach(function (f) { probe(f).catch(function () {}); });
  }

  var API = {
    probe: probe,
    prechauffer: prechauffer,
    inverse: inverse,
    pour: pour,
    classe: classe,
    sousRegle50: sousRegle50,
    surEtat: surEtat,
    etat: etat
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.Tablebase = API;
}(typeof globalThis !== 'undefined' ? globalThis : this));
