/* Finales — boucle de jeu : un exercice se joue jusqu'au bout, sans aucune
   correction coup par coup.

   C'est le point le plus structurant de la spec. L'application ne dit jamais
   « ce coup est une faute » pendant la partie : si le gain est lâché, la
   défense parfaite fait la nulle et l'utilisateur la subit. Tout le jugement
   est différé au débriefing, qui dispose de la frise d'évaluation coup par
   coup et sait donc désigner le coup exact où le résultat a basculé.

   L'évaluation est toujours stockée dans le repère du camp joué, converti
   depuis le camp au trait avant toute comparaison à l'objectif. */
(function (global) {
  'use strict';

  var Rules = global.Rules;
  var TB = global.Tablebase;
  var Defense = global.Defense;

  var PLAFOND_COUPS = 60;        // garde-fou : coups de l'utilisateur

  function apresCoup(fen, uci) {
    var pos = Rules.parseFen(fen);
    var coups = Rules.moves(pos);
    for (var i = 0; i < coups.length; i++) {
      if (coups[i].uci === uci) return Rules.toFen(coups[i].after);
    }
    throw new Error('coup inconnu : ' + uci + ' dans ' + fen);
  }

  function campDe(position) { return position.camp_joue === 'blancs' ? 'w' : 'b'; }

  function finDe(position) {
    var f = position.fin || 'mat';
    if (f.indexOf('coups:') === 0) {
      return { type: 'coups', n: parseInt(f.slice(6), 10) || 20 };
    }
    return { type: f, n: 0 };
  }

  function Partie(finale, position) {
    this.finale = finale;
    this.position = position;
    this.camp = campDe(position);
    this.objectif = position.objectif;            // 'gagner' | 'tenir la nulle'
    this.fin = finDe(position);
    this.depart = position.fen;

    this.pos = Rules.parseFen(position.fen);
    this.coups = [];                              // { uci, san, par, fenApres }
    this.evals = [];                              // { fen, classe, cat, regle50 }
    this.repetitions = Object.create(null);
    this.termine = false;
    this.resultat = null;                         // 'reussi' | 'rate'
    this.raison = '';
    this.abandon = false;
    this.erreur = null;
  }

  Partie.prototype.fen = function () { return Rules.toFen(this.pos); };
  Partie.prototype.trait = function () { return this.pos.turn; };
  Partie.prototype.aLaMain = function () { return !this.termine && this.pos.turn === this.camp; };
  Partie.prototype.coupsLegaux = function () { return Rules.moves(this.pos); };

  /* Classe visée par l'objectif, dans le repère du camp joué. */
  Partie.prototype.classeVisee = function () {
    return this.objectif === 'gagner' ? 'gain' : 'nulle';
  };

  Partie.prototype.evalCourante = function () {
    return this.evals.length ? this.evals[this.evals.length - 1] : null;
  };

  /* Enregistre l'évaluation de la position courante. Rejette si la tablebase
     est injoignable : on préfère bloquer l'exercice plutôt que d'inventer. */
  Partie.prototype.noter = function () {
    var self = this;
    var fen = this.fen();
    return TB.probe(fen).then(function (p) {
      var cat = TB.pour(p.category, self.pos.turn, self.camp);
      self.evals.push({
        fen: fen,
        cat: cat,
        classe: TB.classe(cat),
        regle50: TB.sousRegle50(cat)
      });
      return self.evals[self.evals.length - 1];
    });
  };

  Partie.prototype.demarrer = function () {
    var self = this;
    this.compterRepetition();
    return this.noter().then(function () {
      return self.pos.turn === self.camp ? null : self.jouerApp();
    });
  };

  Partie.prototype.compterRepetition = function () {
    var cle = Rules.repetitionKey(this.pos);
    this.repetitions[cle] = (this.repetitions[cle] || 0) + 1;
    return this.repetitions[cle];
  };

  /* ------------------------------------------------------ fin de l'exercice */

  Partie.prototype.monTour = function () { return this.pos.turn === this.camp; };

  Partie.prototype.nbCoupsUtilisateur = function () {
    var n = 0;
    this.coups.forEach(function (c) { if (c.par === 'moi') n++; });
    return n;
  };

  /* Conclusions imposées par les règles, indépendamment de l'objectif. */
  Partie.prototype.verdictRegles = function () {
    var st = Rules.status(this.pos);
    if (st === 'mat') {
      // Le camp au trait est maté.
      return this.pos.turn === this.camp
        ? { fini: true, classe: 'perte', raison: 'Mat. Vous êtes maté.' }
        : { fini: true, classe: 'gain', raison: 'Mat ! L\'adversaire est maté.' };
    }
    if (st === 'pat') return { fini: true, classe: 'nulle', raison: 'Pat : nulle.' };
    if (st === 'materiel') return { fini: true, classe: 'nulle', raison: 'Matériel insuffisant : nulle.' };
    if (st === 'cinquante') return { fini: true, classe: 'nulle', raison: 'Règle des 50 coups : nulle.' };
    if (this.repetitions[Rules.repetitionKey(this.pos)] >= 3) {
      return { fini: true, classe: 'nulle', raison: 'Triple répétition : nulle.' };
    }
    return null;
  };

  /* Conclusions propres à l'exercice (condition de fin de la finale).

     Une règle traverse tout ce bloc : la classe du verdict vient toujours de
     l'évaluation réelle de la position, jamais de la forme du coup. Promouvoir
     une Dame en prise n'est pas un gain, et capturer une pièce en laissant la
     sienne en l'air non plus — l'exercice ne doit surtout pas féliciter
     l'utilisateur sur la seule apparence du matériel. */
  Partie.prototype.verdictExercice = function () {
    var adverse = Rules.swap(this.camp);
    var dernier = this.coups.length ? this.coups[this.coups.length - 1] : null;
    var ev = this.evalCourante();
    var classe = ev ? ev.classe : 'nulle';

    if (this.fin.type === 'promotion' && dernier && dernier.promo) {
      if (dernier.par === 'moi') {
        return {
          fini: true,
          classe: classe,
          raison: classe === 'gain'
            ? 'Promotion obtenue. La suite est une affaire de technique.'
            : 'Pion promu, mais la position ne vaut plus le gain.'
        };
      }
      return { fini: true, classe: classe, raison: 'L\'adversaire a promu.' };
    }

    if (this.fin.type === 'position') {
      if (this.objectif === 'gagner' && Rules.bareKing(this.pos, adverse) && classe === 'gain') {
        return { fini: true, classe: 'gain', raison: (this.position.fin_detail || 'Position acquise') + '. Objectif atteint.' };
      }
      if (this.objectif === 'tenir la nulle' && Rules.insufficientMaterial(this.pos)) {
        return { fini: true, classe: 'nulle', raison: (this.position.fin_detail || 'Position acquise') + '. La nulle est acquise.' };
      }
    }
    if (this.fin.type === 'coups' && this.nbCoupsUtilisateur() >= this.fin.n && this.monTour()) {
      return { fini: true, classe: classe, raison: this.fin.n + ' coups tenus.' };
    }
    if (this.nbCoupsUtilisateur() >= PLAFOND_COUPS && this.monTour()) {
      return { fini: true, classe: classe, raison: 'Exercice arrêté après ' + PLAFOND_COUPS + ' coups.' };
    }
    return null;
  };

  Partie.prototype.conclure = function (verdict) {
    this.termine = true;
    this.classeFinale = verdict.classe;
    this.raison = verdict.raison;
    this.resultat = verdict.classe === this.classeVisee() ? 'reussi'
      : (this.objectif === 'gagner' && verdict.classe === 'nulle') ? 'rate'
        : verdict.classe === 'gain' ? 'reussi' : 'rate';
    /* Le verdict de l'exercice est figé à sa première conclusion : une
       prolongation « jusqu'au mat » ne doit pas pouvoir transformer
       rétroactivement une réussite en échec. */
    if (this.resultatExercice === undefined) this.resultatExercice = this.resultat;
    return verdict;
  };

  Partie.prototype.verifierFin = function () {
    var v = this.verdictRegles() || this.verdictExercice();
    if (v) this.conclure(v);
    return v;
  };

  /* ------------------------------------------------------------ les coups */

  Partie.prototype.appliquer = function (coup, par, meta) {
    this.pos = coup.after;
    this.coups.push({
      uci: coup.uci,
      san: coup.san,
      par: par,
      promo: !!coup.promo,
      fenApres: this.fen(),
      meta: meta || null
    });
    this.compterRepetition();
  };

  /* `apresMonCoup` est appelé dès que le coup de l'utilisateur est posé sur
     l'échiquier, avant l'interrogation de la tablebase et avant la réponse de
     l'application. Sans ce point d'accroche, la pièce ne bougerait qu'une fois
     l'adversaire ayant répondu, et les deux coups apparaîtraient ensemble. */
  Partie.prototype.jouerUtilisateur = function (uci, apresMonCoup) {
    var self = this;
    if (this.termine) return Promise.resolve(null);
    if (!this.monTour()) return Promise.reject(new Error('ce n\'est pas votre trait'));

    var coup = this.coupsLegaux().filter(function (m) { return m.uci === uci; })[0];
    if (!coup) return Promise.reject(new Error('coup illégal : ' + uci));

    this.appliquer(coup, 'moi');

    /* Le retour de `apresMonCoup` est attendu : l'interface s'en sert pour
       laisser le navigateur repeindre avant que l'adversaire ne réponde. */
    return Promise.resolve(apresMonCoup ? apresMonCoup() : null).then(function () {
      return self.noter();
    }).then(function () {
      if (self.verifierFin()) return null;
      return self.jouerApp();
    });
  };

  Partie.prototype.jouerApp = function () {
    var self = this;
    if (this.termine) return Promise.resolve(null);
    if (this.monTour()) return Promise.resolve(null);

    var fen = this.fen();
    return Defense.choisir(fen, apresCoup).then(function (choix) {
      if (!choix) { self.verifierFin(); return null; }
      var coup = self.coupsLegaux().filter(function (m) { return m.uci === choix.uci; })[0];
      if (!coup) throw new Error('la tablebase propose un coup inconnu : ' + choix.uci);
      self.appliquer(coup, 'app', { raison: choix.raison, correctes: choix.correctes, total: choix.total });
      return self.noter().then(function () {
        self.verifierFin();
        return null;
      });
    });
  };

  /* Les finales qui s'arrêtent avant le mat (promotion obtenue, position
     acquise, N coups tenus) peuvent être poursuivies : on rebascule la
     condition de fin sur le mat et on reprend la partie où elle s'était
     arrêtée. L'historique et la frise continuent de s'accumuler, si bien que
     le débriefing reste cohérent après la prolongation. */
  Partie.prototype.peutContinuer = function () {
    return this.termine && !this.abandon && this.fin.type !== 'mat' &&
      Rules.status(this.pos) === 'encours';
  };

  Partie.prototype.continuerJusquAuMat = function () {
    if (!this.peutContinuer()) return Promise.resolve(null);
    this.fin = { type: 'mat', n: 0 };
    this.prolonge = true;
    this.termine = false;
    this.resultat = null;
    this.raison = '';
    this.classeFinale = null;
    return this.monTour() ? Promise.resolve(null) : this.jouerApp();
  };

  /* Abandon : l'exercice se clôt immédiatement, marqué comme raté. */
  Partie.prototype.abandonner = function () {
    if (this.termine) return;
    this.abandon = true;
    this.conclure({ classe: 'perte', raison: 'Exercice abandonné.' });
  };

  /* ---------------------------------------------------------- débriefing */

  /* Index du coup où le résultat a basculé, ou -1. `evals[i]` est
     l'évaluation après le i-ième demi-coup (evals[0] = position de départ). */
  Partie.prototype.basculement = function () {
    if (!this.evals.length) return -1;
    var rang = { gain: 0, nulle: 1, perte: 2 };
    var depart = rang[this.evals[0].classe];
    for (var i = 1; i < this.evals.length; i++) {
      if (rang[this.evals[i].classe] > depart) return i;
    }
    return -1;
  };

  /* Ce qu'il fallait jouer à la place, depuis la position d'avant le
     basculement, plus la suite correcte. */
  Partie.prototype.variantePunitive = function (indexEval) {
    var i = typeof indexEval === 'number' ? indexEval : this.basculement();
    if (i < 1) return Promise.resolve(null);
    var avant = this.evals[i - 1].fen;
    return TB.probe(avant).then(function (p) {
      var coups = (p.moves || []).slice();
      coups.sort(Defense.comparerQualite);
      var bons = coups.filter(function (m) {
        return TB.classe(TB.inverse(m.category)) === TB.classe(p.category);
      });
      return Defense.variante(avant, apresCoup, 10).then(function (suite) {
        return { fen: avant, bons: bons.map(function (m) { return m.san; }), suite: suite };
      });
    });
  };

  /* Solution depuis la position courante — bouton « montrer la solution ». */
  Partie.prototype.solution = function () {
    return Defense.variante(this.fen(), apresCoup, 12);
  };

  var API = {
    Partie: Partie,
    apresCoup: apresCoup,
    PLAFOND_COUPS: PLAFOND_COUPS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.Game = API;
}(typeof globalThis !== 'undefined' ? globalThis : this));
