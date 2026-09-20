/* Finales — choix du coup de l'application.

   L'app ne joue pas « le meilleur coup » au sens de la tablebase, parce que le
   coup théoriquement optimal est souvent le plus facile à parer. Elle joue,
   parmi les coups qui préservent son résultat, celui qui laisse à
   l'utilisateur le moins de réponses correctes. C'est ce qui transforme un
   exercice en épreuve.

   Symétriquement, dans une position perdue, elle maximise la résistance
   (DTM/DTZ) avant de chercher à piéger : c'est la défense parfaite que la
   spec demande, et la seule façon honnête de faire sentir à l'utilisateur
   qu'il a réellement gagné.

   Toutes les décisions sortent de la tablebase. En cas de panne réseau, la
   fonction rejette plutôt que de deviner un coup. */
(function (global) {
  'use strict';

  var TB = global.Tablebase;

  /* Nombre de candidats sondés pour choisir le coup le plus traître. En
     position gagnée on ne sonde rien : on convertit. */
  var LARGEUR_NULLE = 8;    // quand l'app tient la nulle
  var LARGEUR_PERTE = 3;    // quand elle est perdue

  /* Classe du résultat du coup `m` pour celui qui le joue. `m.category` est
     donnée du point de vue de l'adversaire, qui aura le trait après. */
  function classePourJoueur(m) {
    return TB.classe(TB.inverse(m.category));
  }

  var RANG = { gain: 0, nulle: 1, perte: 2 };

  /* Ordonne les coups du meilleur au pire pour celui qui joue.

     On classe d'abord par résultat, puis on s'en remet à l'ordre de l'API,
     qui range déjà les coups du meilleur au pire pour le camp au trait.

     Ne pas refaire ce tri soi-même à partir de dtz/dtm : deux pièges y
     attendent. Un coup qui mate a `dtm: null`, et le traiter comme « très
     loin » revient à ne jamais mater ; et un coup zéroïsant (prise, poussée
     de pion) remet le compteur DTZ à zéro, si bien que son dtz n'est pas
     comparable à celui d'un coup ordinaire — trier par |dtz| croissant fait
     fuir la promotion, qui « éloigne » le dtz. Les deux erreurs ont été
     commises ici, et donnaient la même conclusion absurde : l'application
     tournait en rond jusqu'à la triple répétition. */
  function comparerQualite(a, b) {
    var ra = RANG[classePourJoueur(a)];
    var rb = RANG[classePourJoueur(b)];
    if (ra !== rb) return ra - rb;
    var oa = typeof a.ordre === 'number' ? a.ordre : 0;
    var ob = typeof b.ordre === 'number' ? b.ordre : 0;
    return oa - ob;
  }

  /* Deux coups objectivement interchangeables : même résultat, même distance
     au zéroïsage et même distance au mat. Sert à varier le jeu de l'app sans
     jamais dégrader son résultat. */
  function memeQualite(a, b) {
    return classePourJoueur(a) === classePourJoueur(b) &&
      a.category === b.category && a.dtz === b.dtz && a.dtm === b.dtm;
  }

  /* Nombre de réponses correctes laissées à l'adversaire après ce coup :
     dans la position fille, combien de ses coups préservent le meilleur
     résultat qu'il puisse encore obtenir. Moins il y en a, plus le coup
     est traître. */
  function compterReponsesCorrectes(fille) {
    var best = TB.classe(fille.category);
    var n = 0;
    (fille.moves || []).forEach(function (m) {
      if (TB.classe(TB.inverse(m.category)) === best) n++;
    });
    return { correctes: n, total: (fille.moves || []).length, resultat: best };
  }

  function tirerAuHasard(liste) {
    return liste[Math.floor(Math.random() * liste.length)];
  }

  /* Choisit le coup que joue l'application dans `fen`.

     Retourne { uci, san, raison, correctes, total } — `raison` sert au
     débriefing et aux tests, pas à l'interface de jeu (qui ne doit rien
     révéler pendant l'exercice). */
  function choisir(fen, apresCoup) {
    return TB.probe(fen).then(function (p) {
      var coups = (p.moves || []).slice();
      if (!coups.length) return null;                 // mat ou pat : rien à jouer

      var maClasse = TB.classe(p.category);
      var preservent = coups.filter(function (m) {
        return classePourJoueur(m) === maClasse;
      });
      var candidats = preservent.length ? preservent : coups;

      candidats.sort(comparerQualite);

      /* Position gagnée : on convertit, point. Chercher un piège ici n'a aucun
         sens — l'adversaire n'a plus une seule réponse correcte à éviter, donc
         la mesure de piège devient dégénérée — et surtout ça fait tourner en
         rond jusqu'à la triple répétition. On joue le mat le plus court, au
         hasard entre les coups également rapides. */
      if (maClasse === 'gain') {
        var aussiRapides = candidats.filter(function (m) {
          return memeQualite(m, candidats[0]);
        });
        var gagnant = tirerAuHasard(aussiRapides);
        return { uci: gagnant.uci, san: gagnant.san, raison: 'conversion la plus rapide' };
      }

      var largeur = maClasse === 'perte' ? LARGEUR_PERTE : LARGEUR_NULLE;
      var retenus = candidats.slice(0, Math.max(1, largeur));

      if (retenus.length === 1) {
        return { uci: retenus[0].uci, san: retenus[0].san, raison: 'coup unique' };
      }

      /* Dans une position perdue, la résistance prime : on ne garde pour le
         départage que les coups qui résistent le plus longtemps. */
      if (maClasse === 'perte') {
        retenus = retenus.filter(function (m) { return memeQualite(m, retenus[0]); });
        if (retenus.length === 1) {
          return { uci: retenus[0].uci, san: retenus[0].san, raison: 'résistance maximale' };
        }
      }

      /* Départage par le piège : on sonde chaque position fille et on garde
         celle qui laisse le moins de bonnes réponses. */
      var fens = retenus.map(function (m) { return apresCoup(fen, m.uci); });
      return Promise.all(fens.map(function (f) {
        return TB.probe(f).then(compterReponsesCorrectes,
          function () { return null; });            // panne : coup non noté
      })).then(function (notes) {
        var notees = [];
        for (var i = 0; i < retenus.length; i++) {
          if (notes[i]) notees.push({ m: retenus[i], n: notes[i] });
        }
        if (!notees.length) {
          var secours = retenus[0];
          return { uci: secours.uci, san: secours.san, raison: 'meilleur coup (sondage indisponible)' };
        }
        var min = Math.min.apply(null, notees.map(function (x) { return x.n.correctes; }));
        var exaequo = notees.filter(function (x) { return x.n.correctes === min; });
        var choisi = tirerAuHasard(exaequo);
        return {
          uci: choisi.m.uci,
          san: choisi.m.san,
          raison: maClasse === 'perte' ? 'résistance maximale, variante la plus coriace' : 'piège',
          correctes: choisi.n.correctes,
          total: choisi.n.total
        };
      });
    });
  }

  /* Variante principale depuis `fen`, du point de vue du camp au trait :
     la suite objectivement correcte, pour la montrer au débriefing. */
  function variante(fen, apresCoup, profondeur) {
    var max = profondeur || 12;
    var suite = [];

    function pas(f, reste) {
      if (!reste) return Promise.resolve(suite);
      return TB.probe(f).then(function (p) {
        var coups = (p.moves || []).slice();
        if (!coups.length) return suite;
        coups.sort(comparerQualite);
        var m = coups[0];
        suite.push({ uci: m.uci, san: m.san });
        return pas(apresCoup(f, m.uci), reste - 1);
      }, function () { return suite; });
    }

    return pas(fen, max);
  }

  var API = { choisir: choisir, variante: variante, comparerQualite: comparerQualite };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.Defense = API;
}(typeof globalThis !== 'undefined' ? globalThis : this));
