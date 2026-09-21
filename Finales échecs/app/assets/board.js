/* Finales — échiquier : rendu et saisie des coups.

   Damier bois clair, pièces en glyphes Unicode pleins dont la couleur est
   faite en CSS (les rendus « pleins / creux » des polices système sont trop
   irréguliers d'un appareil à l'autre pour qu'on s'y fie).

   Saisie au clic : on sélectionne une pièce, les destinations légales
   s'allument, on clique la case d'arrivée. Pas de glisser-déposer — le clic
   marche aussi bien à la souris qu'au doigt, et ne se bat pas avec le
   défilement de la page. */
(function (global) {
  'use strict';

  var Rules = global.Rules;

  var FILES = 'abcdefgh';
  var GLYPHES = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

  function Board(el, options) {
    this.el = el;
    this.options = options || {};
    this.orientation = 'w';
    this.selection = null;
    this.coups = [];
    this.actif = false;
    this.dernier = null;
    this.cases = {};
    this.construire();
  }

  Board.prototype.construire = function () {
    var self = this;
    this.el.innerHTML = '';
    this.el.classList.add('board');

    for (var r = 0; r < 8; r++) {
      for (var f = 0; f < 8; f++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        var nom = FILES[f] + (8 - r);
        btn.className = 'sq ' + ((f + r) % 2 === 0 ? 'light' : 'dark');
        btn.dataset.sq = nom;
        btn.setAttribute('aria-label', 'case ' + nom);
        var span = document.createElement('span');
        span.className = 'piece';
        btn.appendChild(span);
        this.el.appendChild(btn);
        this.cases[nom] = btn;
      }
    }

    this.el.addEventListener('click', function (e) {
      var btn = e.target.closest('.sq');
      if (btn) self.cliquer(btn.dataset.sq);
    });

    /* Un clic hors de l'échiquier abandonne aussi la sélection. */
    document.addEventListener('click', function (e) {
      if (self.selection && !self.el.contains(e.target)) self.deselectionner();
    });
  };

  /* Réordonne les cases dans le DOM selon l'orientation. */
  Board.prototype.orienter = function (camp) {
    this.orientation = camp;
    var noms = Object.keys(this.cases);
    noms.sort(function (a, b) {
      var fa = FILES.indexOf(a[0]), fb = FILES.indexOf(b[0]);
      var ra = parseInt(a[1], 10), rb = parseInt(b[1], 10);
      if (camp === 'b') return (ra - rb) || (fb - fa);
      return (rb - ra) || (fa - fb);
    });
    var frag = document.createDocumentFragment();
    noms.forEach(function (n) { frag.appendChild(this.cases[n]); }, this);
    this.el.appendChild(frag);
    this.el.classList.toggle('vue-noirs', camp === 'b');
  };

  Board.prototype.dessiner = function (fen, coupsLegaux, actif) {
    var pos = Rules.parseFen(fen);
    this.pos = pos;
    this.coups = coupsLegaux || [];
    this.actif = !!actif;
    this.selection = null;

    var echec = Rules.inCheck(pos, pos.turn);
    var roiEnEchec = null;

    for (var nom in this.cases) {
      var btn = this.cases[nom];
      var sq = Rules.fromAlgebraic(nom);
      var p = pos.board[sq];
      var span = btn.firstChild;
      if (p) {
        span.textContent = GLYPHES[Rules.typeOf(p)];
        span.className = 'piece ' + (Rules.colorOf(p) === 'w' ? 'p-w' : 'p-b');
        if (Rules.typeOf(p) === 'k' && Rules.colorOf(p) === pos.turn && echec) roiEnEchec = nom;
      } else {
        span.textContent = '';
        span.className = 'piece';
      }
      btn.classList.remove('sel', 'cible', 'prise', 'echec');
      btn.classList.toggle('dernier', !!this.dernier && (nom === this.dernier.from || nom === this.dernier.to));
      btn.disabled = !this.actif;
    }
    if (roiEnEchec) this.cases[roiEnEchec].classList.add('echec');
  };

  Board.prototype.marquerDernier = function (uci) {
    this.dernier = uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null;
  };

  Board.prototype.effacerIndices = function () {
    for (var nom in this.cases) {
      this.cases[nom].classList.remove('sel', 'cible', 'prise');
    }
  };

  Board.prototype.montrerDestinations = function (depart) {
    this.effacerIndices();
    this.cases[depart].classList.add('sel');
    var self = this;
    this.coups.forEach(function (m) {
      if (Rules.algebraic(m.from) !== depart) return;
      var to = Rules.algebraic(m.to);
      self.cases[to].classList.add(m.captured ? 'prise' : 'cible');
    });
  };

  Board.prototype.deselectionner = function () {
    this.selection = null;
    this.effacerIndices();
  };

  Board.prototype.cliquer = function (nom) {
    if (!this.actif) return;
    var self = this;

    /* Recliquer la pièce déjà sélectionnée l'abandonne. */
    if (this.selection === nom) {
      this.deselectionner();
      return;
    }

    if (this.selection) {
      var candidats = this.coups.filter(function (m) {
        return Rules.algebraic(m.from) === self.selection && Rules.algebraic(m.to) === nom;
      });
      if (candidats.length === 1) {
        this.jouer(candidats[0]);
        return;
      }
      if (candidats.length > 1) {          // promotion : quatre pièces possibles
        this.demanderPromotion(candidats);
        return;
      }
    }

    /* Sinon : soit on sélectionne une autre pièce jouable, soit on a cliqué à
       côté et la sélection tombe. */
    var partants = this.coups.filter(function (m) { return Rules.algebraic(m.from) === nom; });
    if (partants.length) {
      this.selection = nom;
      this.montrerDestinations(nom);
    } else {
      this.deselectionner();
    }
  };

  Board.prototype.jouer = function (coup) {
    this.selection = null;
    this.effacerIndices();
    this.actif = false;
    if (this.options.onCoup) this.options.onCoup(coup);
  };

  Board.prototype.demanderPromotion = function (candidats) {
    var self = this;
    var couche = document.createElement('div');
    couche.className = 'promo-couche';
    var boite = document.createElement('div');
    boite.className = 'promo-boite';
    var titre = document.createElement('p');
    titre.className = 'promo-titre label-mono';
    titre.textContent = 'Promotion';
    boite.appendChild(titre);

    var ordre = ['q', 'r', 'b', 'n'];
    var couleur = this.pos.turn === 'w' ? 'p-w' : 'p-b';
    ordre.forEach(function (t) {
      var m = candidats.filter(function (c) { return c.promo === t; })[0];
      if (!m) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'promo-choix';
      var g = document.createElement('span');
      g.className = 'piece ' + couleur;
      g.textContent = GLYPHES[t];
      b.appendChild(g);
      b.setAttribute('aria-label', { q: 'Dame', r: 'Tour', b: 'Fou', n: 'Cavalier' }[t]);
      b.addEventListener('click', function () {
        document.body.removeChild(couche);
        self.jouer(m);
      });
      boite.appendChild(b);
    });

    couche.appendChild(boite);
    couche.addEventListener('click', function (e) {
      if (e.target === couche) {
        document.body.removeChild(couche);
        self.selection = null;
        self.effacerIndices();
      }
    });
    document.body.appendChild(couche);
  };

  /* Surligne une case (utilisé par le débriefing pour montrer un coup). */
  Board.prototype.souligner = function (uci) {
    this.effacerIndices();
    if (!uci) return;
    var from = uci.slice(0, 2), to = uci.slice(2, 4);
    if (this.cases[from]) this.cases[from].classList.add('sel');
    if (this.cases[to]) this.cases[to].classList.add('cible');
  };

  global.Board = Board;
}(typeof globalThis !== 'undefined' ? globalThis : this));
