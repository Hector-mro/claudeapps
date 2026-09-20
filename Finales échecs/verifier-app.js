/* Vérifie la boucle de jeu sans navigateur.

   Deux propriétés qui doivent tenir pour que l'application soit honnête :

   1. si l'utilisateur joue toujours un coup objectivement correct, l'exercice
      se conclut sur « objectif atteint » et la frise ne montre aucun
      basculement — autrement dit la défense de l'app ne peut pas voler la
      partie, et les conditions de fin ne se déclenchent pas à tort ;

   2. s'il joue un coup qui lâche le résultat, l'exercice se conclut sur
      « objectif manqué » et le débriefing désigne exactement ce coup-là.

   usage : node verifier-app.js [ids séparés par des virgules] */
'use strict';

const fs = require('fs');
const path = require('path');

const ICI = __dirname;

/* localStorage minimal adossé à un fichier : le cache tablebase du navigateur
   sert aussi ici, ce qui rend les relances quasi instantanées. */
const FICHIER = path.join(ICI, '.cache_tablebase', 'localstorage.json');
const store = (() => {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(FICHIER, 'utf8')); } catch (e) { data = {}; }
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
      fs.mkdirSync(path.dirname(FICHIER), { recursive: true });
      fs.writeFileSync(FICHIER, JSON.stringify(data), 'utf8');
    },
    removeItem: (k) => { delete data[k]; }
  };
})();
globalThis.localStorage = store;

require('./app/assets/rules.js');
require('./app/assets/tablebase.js');
require('./app/assets/defense.js');
require('./app/assets/game.js');

const { Rules, Tablebase: TB, Defense, Game } = globalThis;

const finales = JSON.parse(fs.readFileSync(path.join(ICI, 'finales.json'), 'utf8'));

function toutesLesPositions() {
  const out = [];
  finales.forEach((f) => f.positions.forEach((p) => out.push({ finale: f, position: p })));
  return out;
}

/* Meilleur coup pour le camp au trait, selon la tablebase. */
async function meilleurCoup(fen) {
  const p = await TB.probe(fen);
  const coups = (p.moves || []).slice();
  if (!coups.length) return null;
  coups.sort(Defense.comparerQualite);
  return coups[0].uci;
}

/* Un coup qui dégrade le résultat du camp au trait, s'il en existe un. */
async function coupQuiLache(fen) {
  const p = await TB.probe(fen);
  const rang = { gain: 0, nulle: 1, perte: 2 };
  const actuel = rang[TB.classe(p.category)];
  const mauvais = (p.moves || []).filter(
    (m) => rang[TB.classe(TB.inverse(m.category))] > actuel
  );
  return mauvais.length ? mauvais[0].uci : null;
}

async function jouerParfait(finale, position, plafond = 80) {
  const partie = new Game.Partie(finale, position);
  await partie.demarrer();
  let n = 0;
  while (!partie.termine && n++ < plafond) {
    const uci = await meilleurCoup(partie.fen());
    if (!uci) break;
    await partie.jouerUtilisateur(uci);
  }
  return partie;
}

async function jouerAvecUneFaute(finale, position, plafond = 80) {
  const partie = new Game.Partie(finale, position);
  await partie.demarrer();
  if (partie.termine) return null;

  const rate = await coupQuiLache(partie.fen());
  if (!rate) return null;                       // pas de faute possible ici

  /* Le demi-coup fautif n'est pas toujours le premier : quand le camp joué
     n'est pas celui au trait, l'application a déjà joué. */
  const indexFaute = partie.coups.length + 1;
  await partie.jouerUtilisateur(rate);

  let n = 0;
  while (!partie.termine && n++ < plafond) {
    const uci = await meilleurCoup(partie.fen());
    if (!uci) break;
    await partie.jouerUtilisateur(uci);
  }
  return { partie, indexFaute };
}

/* Après un exercice réussi qui s'arrête avant le mat, la prolongation doit
   pouvoir aller jusqu'au mat sans réécrire le verdict de l'exercice. */
async function prolonger(partie, plafond = 60) {
  if (!partie.peutContinuer()) return null;
  const avant = partie.resultatExercice;
  await partie.continuerJusquAuMat();
  let n = 0;
  while (!partie.termine && n++ < plafond) {
    const uci = await meilleurCoup(partie.fen());
    if (!uci) break;
    await partie.jouerUtilisateur(uci);
  }
  return { avant, apres: partie.resultatExercice, termine: partie.termine, raison: partie.raison };
}

async function main() {
  const filtre = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
  const cibles = toutesLesPositions().filter((x) => !filtre || filtre.has(x.position.id));

  let ok = 0;
  const soucis = [];

  for (const { finale, position } of cibles) {
    // 1. jeu parfait
    let partie;
    try {
      partie = await jouerParfait(finale, position);
    } catch (e) {
      soucis.push(`${position.id} : exception en jeu parfait — ${e.message}`);
      continue;
    }
    if (!partie.termine) {
      soucis.push(`${position.id} : la partie ne se termine pas (plafond atteint)`);
    } else if (partie.resultat !== 'reussi') {
      soucis.push(`${position.id} : jeu parfait mais résultat « ${partie.resultat} » — ${partie.raison}`);
    } else if (partie.basculement() !== -1) {
      const i = partie.basculement();
      soucis.push(`${position.id} : jeu parfait mais basculement annoncé au demi-coup ${i} (${partie.coups[i - 1].san})`);
    } else {
      ok++;

      // 1 bis. prolongation jusqu'au mat, quand l'exercice s'arrête avant
      try {
        const p = await prolonger(partie);
        if (p) {
          if (p.avant !== p.apres) {
            soucis.push(`${position.id} : la prolongation a réécrit le verdict (${p.avant} -> ${p.apres})`);
          } else if (!p.termine) {
            soucis.push(`${position.id} : la prolongation ne se termine pas`);
          } else {
            ok++;
          }
        }
      } catch (e) {
        soucis.push(`${position.id} : exception en prolongation — ${e.message}`);
      }
    }

    // 2. une faute délibérée au premier coup
    let fautif;
    try {
      fautif = await jouerAvecUneFaute(finale, position);
    } catch (e) {
      soucis.push(`${position.id} : exception en jeu fautif — ${e.message}`);
      continue;
    }
    if (fautif) {
      const g = fautif.partie;
      if (g.resultat !== 'rate') {
        soucis.push(`${position.id} : faute délibérée mais résultat « ${g.resultat} » — ${g.raison}`);
      } else if (g.basculement() !== fautif.indexFaute) {
        soucis.push(`${position.id} : basculement attendu au demi-coup ${fautif.indexFaute}, obtenu ${g.basculement()}`);
      } else {
        ok++;
      }
    }

    process.stdout.write('.');
  }

  console.log(`\n${ok} vérifications passées sur ${cibles.length} positions.`);
  if (soucis.length) {
    console.log('\nPROBLÈMES :');
    soucis.forEach((s) => console.log('  ' + s));
    process.exit(1);
  }
  console.log('Aucun problème.');
}

main().catch((e) => { console.error(e); process.exit(1); });
