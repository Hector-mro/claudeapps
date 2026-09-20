/* Finales — écrans, sélection, tirage et débriefing.

   Trois écrans : l'accueil (plage de finales et tirage), l'exercice (qui ne
   dit jamais rien), le débriefing (qui dit tout). */
(function (global) {
  'use strict';

  var Rules = global.Rules;
  var TB = global.Tablebase;
  var Game = global.Game;

  var CLE_PLAGE = 'finales.plage.v1';

  var donnees = [];
  var plage = { de: 1, a: 20 };
  var partie = null;
  var board = null;
  var relecture = null;

  function $(id) { return document.getElementById(id); }
  function texte(el, s) { el.textContent = s; }

  /* Construction DOM explicite plutôt que des chaînes de balisage : les titres
     et les notes viennent de finales.json, et on ne veut pas d'un rendu qui
     dépende de leur ponctuation. */
  function bal(tag, classe, contenu) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (contenu !== undefined && contenu !== null) e.textContent = contenu;
    return e;
  }

  /* L'échiquier est unique : on le déplace d'un écran à l'autre plutôt que
     d'en maintenir deux en parallèle, qui finiraient par diverger. */
  function montrer(ecran) {
    ['home', 'jeu', 'debrief'].forEach(function (n) {
      $('s-' + n).classList.toggle('active', n === ecran);
    });
    var el = $('board');
    if (ecran === 'debrief') $('debrief-board-slot').appendChild(el);
    else if (ecran === 'jeu') $('jeu-board-slot').insertBefore(el, $('jeu-attente'));
    global.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------ sélection */

  function chargerPlage() {
    try {
      var v = JSON.parse(localStorage.getItem(CLE_PLAGE));
      if (v && v.de >= 1 && v.a <= 20 && v.de <= v.a) plage = v;
    } catch (e) { /* valeurs par défaut */ }
  }

  function enregistrerPlage() {
    try { localStorage.setItem(CLE_PLAGE, JSON.stringify(plage)); } catch (e) {}
  }

  function finalesSelectionnees() {
    return donnees.filter(function (f) { return f.numero >= plage.de && f.numero <= plage.a; });
  }

  function positionsSelectionnees() {
    var out = [];
    finalesSelectionnees().forEach(function (f) {
      f.positions.forEach(function (p) { out.push({ finale: f, position: p }); });
    });
    return out;
  }

  function rendreAccueil() {
    $('plage-de').value = plage.de;
    $('plage-a').value = plage.a;

    var liste = $('liste-finales');
    liste.innerHTML = '';
    finalesSelectionnees().forEach(function (f) {
      var li = document.createElement('li');
      li.className = 'finale-item';

      var tete = bal('div', 'finale-tete');
      tete.appendChild(bal('span', 'mono finale-num', f.numero));
      tete.appendChild(bal('span', 'finale-titre', f.titre));
      li.appendChild(tete);

      var pos = bal('div', 'finale-positions');
      f.positions.forEach(function (p) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pos-chip';
        b.appendChild(bal('span', 'mono', p.id));
        b.appendChild(document.createTextNode(' '));
        b.appendChild(bal('em', null, p.objectif === 'gagner' ? 'gagner' : 'tenir'));
        b.title = p.theme + ' — vous jouez les ' + p.camp_joue;
        b.addEventListener('click', function () { lancer(f, p); });
        pos.appendChild(b);
      });
      li.appendChild(pos);
      liste.appendChild(li);
    });

    var n = positionsSelectionnees().length;
    texte($('recap'), n + ' position' + (n > 1 ? 's' : '') + ' dans la sélection, ' +
      finalesSelectionnees().length + ' finale' + (finalesSelectionnees().length > 1 ? 's' : '') + '.');
    $('btn-tirage').disabled = n === 0;
  }

  /* --------------------------------------------------------------- partie */

  function etiquetteObjectif(p) {
    return p.objectif === 'gagner' ? 'Gagner' : 'Tenir la nulle';
  }

  function etiquetteFin(p) {
    var f = p.fin || 'mat';
    if (f === 'mat') return 'jusqu\'au mat';
    if (f === 'promotion') return 'jusqu\'à la promotion';
    if (f.indexOf('coups:') === 0) return 'tenir ' + f.slice(6) + ' coups';
    return p.fin_detail || 'jusqu\'à la position acquise';
  }

  function lancer(finale, position) {
    partie = new Game.Partie(finale, position);
    relecture = null;

    texte($('jeu-num'), 'Finale ' + finale.numero);
    texte($('jeu-titre'), finale.titre);
    texte($('jeu-theme'), position.theme);
    texte($('jeu-objectif'), etiquetteObjectif(position));
    texte($('jeu-camp'), 'Vous jouez les ' + position.camp_joue);
    texte($('jeu-fin'), etiquetteFin(position));
    $('jeu-objectif').className = 'consigne-valeur ' +
      (position.objectif === 'gagner' ? 'obj-gain' : 'obj-nulle');

    $('liste-coups').innerHTML = '';
    $('jeu-message').textContent = '';
    $('jeu-message').className = 'jeu-message';
    $('btn-solution').disabled = false;

    board.orienter(partie.camp);
    board.marquerDernier(null);
    board.dessiner(partie.fen(), [], false);
    montrer('jeu');

    penser(true);
    partie.demarrer().then(function () {
      rafraichirJeu();
    }).catch(erreurReseau);
  }

  function penser(oui) {
    $('jeu-attente').hidden = !oui;
  }

  function erreurReseau(e) {
    penser(false);
    var m = $('jeu-message');
    m.className = 'jeu-message alerte';
    m.textContent = 'Tablebase injoignable — l\'exercice ne peut pas continuer. ' +
      'Vérifiez la connexion, puis rejouez le coup.';
    console.error(e);
    if (partie && !partie.termine) {
      board.dessiner(partie.fen(), partie.aLaMain() ? partie.coupsLegaux() : [], partie.aLaMain());
    }
  }

  function rendreCoups() {
    var ul = $('liste-coups');
    ul.innerHTML = '';
    var pos = Rules.parseFen(partie.depart);
    var numero = pos.full;
    var blancCommence = pos.turn === 'w';

    function nouvelleLigne(avecEllipse) {
      var li = document.createElement('li');
      var n = document.createElement('span');
      n.className = 'mono num';
      n.textContent = numero + '.';
      li.appendChild(n);
      if (avecEllipse) {
        var e = document.createElement('span');
        e.className = 'san vide';
        e.textContent = '…';
        li.appendChild(e);
      }
      ul.appendChild(li);
      return li;
    }

    var ligne = null;
    partie.coups.forEach(function (c, i) {
      var estBlanc = blancCommence ? (i % 2 === 0) : (i % 2 === 1);
      if (estBlanc) ligne = nouvelleLigne(false);
      else if (!ligne) ligne = nouvelleLigne(true);

      var s = document.createElement('span');
      s.className = 'san' + (c.par === 'moi' ? ' moi' : '');
      s.textContent = c.san;
      ligne.appendChild(s);

      if (!estBlanc) { numero++; ligne = null; }   // le numéro avance après les Noirs
    });
    ul.scrollTop = ul.scrollHeight;
  }

  function rafraichirJeu() {
    penser(false);
    board.marquerDernier(partie.coups.length ? partie.coups[partie.coups.length - 1].uci : null);
    var monTour = partie.aLaMain();
    board.dessiner(partie.fen(), monTour ? partie.coupsLegaux() : [], monTour);
    rendreCoups();

    if (partie.termine) {
      $('btn-solution').disabled = true;
      ouvrirDebrief();
    }
  }

  /* Rend la main au navigateur le temps d'un rendu. `requestAnimationFrame`
     s'exécute avant la peinture, le `setTimeout` qu'il programme après : la
     combinaison garantit qu'au moins une image a été peinte. Sans ça, quand
     toutes les positions sont déjà en cache, la chaîne de promesses se déroule
     en microtâches et les deux coups apparaissent ensemble. */
  function attendreRendu(ms) {
    return new Promise(function (r) {
      requestAnimationFrame(function () { setTimeout(r, ms || 0); });
    });
  }

  function jouerCoup(coup) {
    $('jeu-message').textContent = '';
    partie.jouerUtilisateur(coup.uci, function () {
      // Le coup est posé : on le montre tout de suite, échiquier inerte.
      board.marquerDernier(coup.uci);
      board.dessiner(partie.fen(), [], false);
      rendreCoups();
      penser(true);
      return attendreRendu(90);         // un battement, puis l'adversaire joue
    }).then(function () {
      rafraichirJeu();
    }).catch(erreurReseau);
  }

  /* ----------------------------------------------------------- débriefing */

  var LIB_CLASSE = { gain: 'gain', nulle: 'nulle', perte: 'perte' };

  function frise() {
    var el = $('frise');
    el.innerHTML = '';
    var bascule = partie.basculement();

    partie.evals.forEach(function (ev, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'frise-case ' + LIB_CLASSE[ev.classe];
      if (i === bascule) d.classList.add('bascule');
      if (i > 0 && partie.coups[i - 1] && partie.coups[i - 1].par === 'moi') d.classList.add('moi');
      d.dataset.i = i;
      var quoi = i === 0 ? 'départ' : partie.coups[i - 1].san;
      d.title = quoi + ' — ' + ({ gain: 'gagnant', nulle: 'nulle', perte: 'perdant' }[ev.classe]) +
        (ev.regle50 ? ' (dépend de la règle des 50 coups)' : '');
      d.setAttribute('aria-label', d.title);
      d.addEventListener('click', function () { allerA(i); });
      el.appendChild(d);
    });
  }

  function allerA(i) {
    relecture = i;
    var fen = i === 0 ? partie.depart : partie.coups[i - 1].fenApres;
    board.marquerDernier(i === 0 ? null : partie.coups[i - 1].uci);
    board.dessiner(fen, [], false);
    var quoi = i === 0 ? 'Position de départ' : ('Après ' + partie.coups[i - 1].san +
      ' (' + (partie.coups[i - 1].par === 'moi' ? 'vous' : 'l\'adversaire') + ')');
    texte($('debrief-pas'), quoi);
    Array.prototype.forEach.call($('frise').children, function (c, j) {
      c.classList.toggle('vu', j === i);
    });
  }

  function ouvrirDebrief() {
    /* Le verdict porte sur l'objectif de l'exercice, figé à sa première
       conclusion : une prolongation jusqu'au mat ne le réécrit pas. */
    var ok = (partie.resultatExercice || partie.resultat) === 'reussi';
    $('debrief-verdict').className = 'verdict ' + (ok ? 'ok' : 'ko');
    texte($('debrief-verdict'), ok ? 'Objectif atteint' : 'Objectif manqué');
    texte($('debrief-raison'),
      partie.prolonge ? 'Prolongation jusqu\'au mat : ' + partie.raison : partie.raison);
    texte($('debrief-consigne'), 'Finale ' + partie.finale.numero + ' · ' + partie.finale.titre +
      ' · ' + etiquetteObjectif(partie.position).toLowerCase() + ' avec les ' + partie.position.camp_joue);
    texte($('debrief-note'), partie.position.note);

    frise();
    allerA(partie.evals.length - 1);
    $('debrief-continuer').hidden = !partie.peutContinuer();

    var zone = $('debrief-bascule');
    zone.innerHTML = '';
    var i = partie.basculement();
    if (i < 0) {
      var p = document.createElement('p');
      p.className = 'note';
      p.textContent = ok
        ? 'Le résultat théorique n\'a jamais bougé : la conduite était juste d\'un bout à l\'autre.'
        : 'Le résultat théorique n\'a jamais bougé — la position ne promettait pas mieux.';
      zone.appendChild(p);
      montrer('debrief');
      return;
    }

    var coup = partie.coups[i - 1];
    var entete = bal('p', 'bascule-entete', 'Le résultat a basculé sur ');
    entete.appendChild(bal('b', 'mono', coup.san));
    entete.appendChild(document.createTextNode(
      coup.par === 'moi' ? ', votre coup.' : ', le coup de l\'adversaire.'));
    zone.appendChild(entete);

    var chargement = bal('p', 'note', 'Recherche de la variante correcte…');
    zone.appendChild(chargement);

    partie.variantePunitive(i).then(function (v) {
      zone.removeChild(chargement);
      if (!v) return;
      if (v.bons.length) {
        var bons = bal('p', null, 'Il fallait jouer ');
        bons.appendChild(bal('span', 'mono', v.bons.slice(0, 6).join(', ')));
        bons.appendChild(document.createTextNode(
          v.bons.length > 1 ? ' (plusieurs coups tenaient).' : ' — le seul coup.'));
        zone.appendChild(bons);
      }
      if (v.suite.length) {
        zone.appendChild(bal('p', 'variante mono',
          v.suite.map(function (m) { return m.san; }).join(' ')));
      }
      var revoir = document.createElement('button');
      revoir.type = 'button';
      revoir.className = 'btn ghost sm';
      revoir.textContent = 'Revoir la position d\'avant';
      revoir.addEventListener('click', function () { allerA(i - 1); });
      zone.appendChild(revoir);
    }).catch(function () {
      chargement.textContent = 'Variante indisponible (tablebase injoignable).';
    });

    montrer('debrief');
  }

  /* ------------------------------------------------------------- solution */

  function montrerSolution() {
    if (!partie || partie.termine) return;
    $('btn-solution').disabled = true;
    penser(true);
    /* On calcule la suite avant d'abandonner : abandonner ne touche pas à
       l'échiquier, mais l'ordre rend l'intention explicite. */
    partie.solution().then(function (suite) {
      partie.abandonner();
      penser(false);
      rafraichirJeu();                      // déclenche l'ouverture du débriefing
      var zone = $('debrief-bascule');
      var t = document.createElement('p');
      t.className = 'bascule-entete';
      t.textContent = 'La suite correcte depuis la position abandonnée :';
      var p = document.createElement('p');
      p.className = 'variante mono';
      p.textContent = suite.map(function (m) { return m.san; }).join(' ');
      zone.appendChild(t);
      zone.appendChild(p);
    }).catch(erreurReseau);
  }

  /* ---------------------------------------------------------------- câblage */

  function tirage() {
    var toutes = positionsSelectionnees();
    if (!toutes.length) return;
    var choix = toutes[Math.floor(Math.random() * toutes.length)];
    lancer(choix.finale, choix.position);
  }

  function brancher() {
    board = new global.Board($('board'), { onCoup: jouerCoup });

    $('plage-de').addEventListener('change', function () {
      plage.de = Math.min(Math.max(1, parseInt(this.value, 10) || 1), 20);
      if (plage.de > plage.a) plage.a = plage.de;
      enregistrerPlage(); rendreAccueil();
    });
    $('plage-a').addEventListener('change', function () {
      plage.a = Math.min(Math.max(1, parseInt(this.value, 10) || 20), 20);
      if (plage.a < plage.de) plage.de = plage.a;
      enregistrerPlage(); rendreAccueil();
    });

    $('btn-tirage').addEventListener('click', tirage);
    $('btn-quitter').addEventListener('click', function () { montrer('home'); });
    $('btn-solution').addEventListener('click', montrerSolution);
    $('debrief-retour').addEventListener('click', function () { montrer('home'); });
    $('debrief-rejouer').addEventListener('click', function () {
      lancer(partie.finale, partie.position);
    });
    $('debrief-suivante').addEventListener('click', tirage);
    $('debrief-continuer').addEventListener('click', function () {
      texte($('jeu-fin'), 'jusqu\'au mat');
      $('btn-solution').disabled = false;
      $('jeu-message').textContent = '';
      $('jeu-message').className = 'jeu-message';
      montrer('jeu');
      penser(true);
      partie.continuerJusquAuMat().then(rafraichirJeu).catch(erreurReseau);
    });

    $('debrief-prec').addEventListener('click', function () {
      allerA(Math.max(0, (relecture === null ? partie.evals.length - 1 : relecture) - 1));
    });
    $('debrief-suiv').addEventListener('click', function () {
      allerA(Math.min(partie.evals.length - 1, (relecture === null ? 0 : relecture) + 1));
    });

    TB.surEtat(function (etat) {
      $('reseau').hidden = etat.enLigne;
    });
  }

  function demarrer() {
    chargerPlage();
    brancher();
    fetch('../finales.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        donnees = d;
        rendreAccueil();
        $('chargement').hidden = true;
        $('home-contenu').hidden = false;
      })
      .catch(function (e) {
        texte($('chargement'),
          'Impossible de lire finales.json. Cette page doit être servie par un serveur ' +
          'HTTP (par exemple « python -m http.server » à la racine du dossier), pas ouverte ' +
          'directement depuis le disque.');
        console.error(e);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
