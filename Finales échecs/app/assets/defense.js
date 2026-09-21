/* Finales — choix du coup de l'application.

   L'app ne joue pas « le meilleur coup » au sens de la tablebase, parce que le
   coup théoriquement optimal est souvent le plus facile à parer. Elle joue,
   parmi les coups qui préservent son résultat, celui qui laisse à
   l'utilisateur le plus de façons de tout jeter. C'est ce qui transforme un
   exercice en épreuve.

   Symétriquement, dans une position perdue, elle maximise la résistance
   (DTM/DTZ) avant de chercher à piéger : c'est la défense parfaite que la
   spec demande, et la seule façon honnête de faire sentir à l'utilisateur
   qu'il a réellement gagné.

   Toutes les décisions sortent de la tablebase. En cas de panne réseau, la
   fonction rejette plutôt que de deviner un coup.

   ── La mesure du piège, et pourquoi elle n'est pas un simple compte ──

   Le premier jet minimisait le nombre absolu de réponses correctes laissées à
   l'adversaire. C'était faux, et de la pire façon : un coup qui rétrécit
   l'éventail *légal* de l'adversaire marquait aussi bien qu'un coup qui
   rétrécit son éventail *correct*. Les échecs et les prises rétrécissent
   mécaniquement l'éventail légal — ils gagnaient donc ce départage par
   construction. Cas limite atteint en pratique : rendre la Dame contre le pion
   ne laissait que trois réponses, toutes nulles, et marquait mieux qu'une vraie
   manœuvre ; l'exercice « tenez la nulle » se concluait au premier coup sur une
   nulle que personne n'avait eu à défendre.

   La grandeur qui compte est `pieges = total - correctes` : le nombre de
   réponses qui *jettent* le résultat. Elle ne coûte aucune requête de plus, et
   elle dit d'elle-même qu'un exercice est mort — Roi contre Roi, ou toute
   position où tout se vaut, donne `pieges = 0` sans qu'on ait eu à lui
   apprendre ce qu'est une Dame. On classe sur `pieges / total`, la probabilité
   qu'une réponse négligente lâche tout.

   Ne pas revenir au compte absolu. */
(function (global) {
  'use strict';

  var TB = global.Tablebase;
  var Rules = global.Rules;

  /* Nombre de candidats sondés pour choisir le coup le plus traître. En
     position gagnée on ne sonde rien : on convertit.

     Huit, et pas davantage, parce que le coût est entièrement dicté par
     l'espacement des requêtes que l'API publique tolère (250 ms) : neuf
     sondages font deux secondes et quart, douze en font trois et quart, et
     au-delà on commence à récolter des 429 dont la reprise exponentielle
     coûte bien plus cher que le sondage économisé. L'arrêt par borne (voir
     `departager`) en consomme souvent moins, et le cache rend les passages
     suivants instantanés. */
  var LARGEUR_NULLE = 8;    // quand l'app tient la nulle
  var LARGEUR_PERTE = 3;    // quand elle est perdue
  var LOT = 4;              // sondages lancés de front (voir `departager`)

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
     tournait en rond jusqu'à la triple répétition.

     Attention à la portée de ce tri : dans une position nulle, *tous* les
     coups sont `draw`, le premier critère ne départage rien et `ordre` n'est
     plus qu'un ordre interne à l'API, sans rapport avec la difficulté. Y
     tronquer la liste des candidats revient à tirer au sort. C'est
     `departager` qui classe, là. */
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

  /* Dans la position fille : combien des coups de l'adversaire préservent le
     meilleur résultat qu'il puisse encore obtenir, et combien le jettent. */
  function compterReponsesCorrectes(fille) {
    var best = TB.classe(fille.category);
    var n = 0;
    (fille.moves || []).forEach(function (m) {
      if (TB.classe(TB.inverse(m.category)) === best) n++;
    });
    return { correctes: n, total: (fille.moves || []).length, resultat: best };
  }

  /* Part des réponses adverses qui jettent le résultat. Zéro veut dire que le
     coup n'apprend rien : quoi que joue l'adversaire, rien ne change. */
  function score(note) {
    return note.total ? (note.total - note.correctes) / note.total : 0;
  }

  function tirerAuHasard(liste) {
    return liste[Math.floor(Math.random() * liste.length)];
  }

  /* Départage des coups que la tablebase juge équivalents, par la corde qu'ils
     laissent à l'adversaire.

     Retourne { notes, candidats } : `candidats` est le nombre de coups ayant
     survécu aux exclusions locales, ce qui permet à l'appelant de distinguer
     « position morte » de « tablebase injoignable ». */
  function departager(fen, retenus, largeur, apresCoup) {
    /* a. Exclusions locales, gratuites — aucune requête.

       Une position à matériel insuffisant arrête la partie sur-le-champ. Une
       position où l'adversaire n'a qu'un coup légal (ou zéro : pat) ne lui
       laisse rien à trouver, puisque `correctes >= 1` par définition et donc
       `pieges <= total - 1`. Ce sont exactement les prises et les échecs
       forçants qui gagnaient l'ancien départage. */
    var vivants = [];
    retenus.forEach(function (m) {
      var apres = apresCoup(fen, m.uci);
      var pos = Rules.parseFen(apres);
      if (Rules.insufficientMaterial(pos)) return;
      var total = Rules.moves(pos).length;
      if (total <= 1) return;
      vivants.push({ m: m, fen: apres, total: total });
    });

    /* b. `pieges <= total - 1`, donc le score d'un candidat est borné par
       (total - 1) / total, qui croît avec `total`. Trier par éventail
       décroissant, c'est donc trier par borne supérieure décroissante. C'est
       une borne exacte, pas une intuition — d'où l'arrêt du point c. */
    vivants.sort(function (a, b) { return b.total - a.total; });
    vivants = vivants.slice(0, largeur);

    var notes = [];
    var i = 0;

    /* c. Sondage par lots, avec arrêt dès que la borne du meilleur candidat
       restant ne peut plus battre le meilleur score déjà trouvé.

       Par lots et non un par un : sonder strictement en séquence rendrait la
       borne maximale, mais ré-empilerait les requêtes une par une dans la file
       de `tablebase.js`, qui ne peut alors plus les faire se recouvrir. Le
       coût par sondage passe alors de l'espacement seul (250 ms) à
       l'espacement plus un aller-retour complet. Mesuré sur cette API :
       quatre requêtes en série coûtent 579 ms, les mêmes quatre en parallèle
       145 ms. Quatre de front conservent l'essentiel de l'élagage et ramènent
       une décision de 3,2 s à 2,2 s.

       Ne pas pousser le parallélisme plus loin pour autant : c'est
       l'espacement qui protège des 429, dont la reprise exponentielle coûte
       bien plus cher que tout ce qu'on gagnerait. */
    function pas() {
      if (i >= vivants.length) return Promise.resolve();

      if (notes.length) {
        var meilleur = Math.max.apply(null, notes.map(score));
        var borne = (vivants[i].total - 1) / vivants[i].total;   // la meilleure restante
        if (borne <= meilleur) return Promise.resolve();
      }

      var lot = vivants.slice(i, i + LOT);
      i += lot.length;

      return Promise.all(lot.map(function (c) {
        return TB.probe(c.fen).then(function (fille) {
          var n = compterReponsesCorrectes(fille);
          /* Le générateur local a été validé contre la tablebase sur des
             milliers de coups : un écart ici signale une régression, pas un
             aléa. On garde le compte de la tablebase et on le dit. */
          if (n.total !== c.total && global.console) {
            global.console.warn('éventail divergent après ' + c.m.uci + ' : ' +
              c.total + ' en local, ' + n.total + ' selon la tablebase');
          }
          notes.push({ m: c.m, correctes: n.correctes, total: n.total });
        }, function () {
          /* Panne réseau sur cette fille : le coup reste jouable, simplement
             non noté. */
        });
      })).then(pas);
    }

    return pas().then(function () {
      return { notes: notes, candidats: vivants.length };
    });
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

      /* Dans une position perdue, la résistance prime : on ne garde pour le
         départage que les coups qui résistent le plus longtemps.

         Dans une position nulle au contraire, on ne tronque rien ici : la
         tablebase ne sait pas classer ces coups-là (voir `comparerQualite`),
         et les couper sur son ordre revient à en éliminer les trois quarts au
         hasard. C'est `departager` qui restreint, sur une borne qui a un
         sens. */
      var largeur, retenus;
      if (maClasse === 'perte') {
        largeur = LARGEUR_PERTE;
        retenus = candidats.slice(0, Math.max(1, largeur));
        retenus = retenus.filter(function (m) { return memeQualite(m, retenus[0]); });
        if (retenus.length === 1) {
          return { uci: retenus[0].uci, san: retenus[0].san, raison: 'résistance maximale' };
        }
      } else {
        largeur = LARGEUR_NULLE;
        retenus = candidats;
        if (retenus.length === 1) {
          return { uci: retenus[0].uci, san: retenus[0].san, raison: 'coup unique' };
        }
      }

      return departager(fen, retenus, largeur, apresCoup).then(function (r) {
        var notes = r.notes;
        var max = notes.length ? Math.max.apply(null, notes.map(score)) : 0;

        if (max <= 0) {
          /* Soit aucun coup ne laisse la moindre corde — la position est morte
             quoi qu'on joue —, soit la tablebase n'a pas répondu. On revient au
             meilleur coup objectif, au hasard entre équivalents. */
          var equivalents = retenus.filter(function (m) { return memeQualite(m, retenus[0]); });
          var repli = tirerAuHasard(equivalents);
          var raison = (r.candidats && !notes.length) ? 'meilleur coup (sondage indisponible)'
            : maClasse === 'perte' ? 'résistance maximale'
              : 'position sans ressource';
          return { uci: repli.uci, san: repli.san, raison: raison };
        }

        /* Le plus de corde d'abord ; à égalité, le chemin le plus étroit. */
        var tete = notes.filter(function (x) { return score(x) === max; });
        var minC = Math.min.apply(null, tete.map(function (x) { return x.correctes; }));
        var exaequo = tete.filter(function (x) { return x.correctes === minC; });
        var choisi = tirerAuHasard(exaequo);

        return {
          uci: choisi.m.uci,
          san: choisi.m.san,
          raison: maClasse === 'perte' ? 'résistance maximale, variante la plus coriace' : 'piège',
          correctes: choisi.correctes,
          total: choisi.total
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
