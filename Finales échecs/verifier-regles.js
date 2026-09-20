/* Vérifie le générateur de coups de app/assets/rules.js contre un oracle
   indépendant : la liste de coups légaux que renvoie la tablebase Lichess.

   Pour chaque position de départ de finales.json, on marche au hasard dans
   l'arbre (graine fixe, donc reproductible) et on compare à chaque pas
   l'ensemble des coups UCI produits localement à celui de l'API. Toute
   divergence — coup manquant, coup illégal généré, sous-promotion oubliée —
   apparaît immédiatement.

   Le cache disque est partagé avec valider_finales.py (même nom de fichier :
   sha1 de la FEN), donc les positions déjà interrogées ne le sont pas deux fois.

   usage : node verifier-regles.js [pas-par-position] */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const Rules = require('./app/assets/rules.js');

const ICI = __dirname;
const CACHE = path.join(ICI, '.cache_tablebase');
const API = 'https://tablebase.lichess.ovh/standard';
const DELAI = 700;          // l'API publique renvoie 429 bien avant 400 ms
const REPRISES = 4;

let derniere = 0;

function dormir(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function interroger(fen) {
  const cle = crypto.createHash('sha1').update(fen, 'utf8').digest('hex');
  const chemin = path.join(CACHE, cle + '.json');
  if (fs.existsSync(chemin)) return JSON.parse(fs.readFileSync(chemin, 'utf8'));

  const url = API + '?fen=' + encodeURIComponent(fen);
  let pause = 2000;

  for (let essai = 0; ; essai++) {
    const attente = DELAI - (Date.now() - derniere);
    if (attente > 0) await dormir(attente);

    let res;
    try {
      res = await fetch(url);
    } finally {
      derniere = Date.now();
    }

    if (res.status === 429 && essai < REPRISES) {
      await dormir(pause);
      pause *= 2;
      continue;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status + ' sur ' + fen);

    const data = await res.json();
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(chemin, JSON.stringify(data), 'utf8');
    return data;
  }
}

/* Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ensemble(list) { return new Set(list); }

function diff(a, b) { return [...a].filter((x) => !b.has(x)); }

async function main() {
  const pas = parseInt(process.argv[2], 10) || 12;
  const finales = JSON.parse(fs.readFileSync(path.join(ICI, 'finales.json'), 'utf8'));
  const alea = rng(20260920);

  let positionsVues = 0;
  let coupsCompares = 0;
  const problemes = [];

  for (const finale of finales) {
    for (const depart of finale.positions) {
      let pos = Rules.parseFen(depart.fen);

      for (let i = 0; i < pas; i++) {
        const fen = Rules.toFen(pos);
        if (Rules.pieceList(pos).length > 7) break;   // hors tablebase

        let data;
        try {
          data = await interroger(fen);
        } catch (e) {
          problemes.push(`${depart.id} pas ${i} : tablebase indisponible (${e.message})`);
          break;
        }

        const mine = Rules.moves(pos);
        const a = ensemble(mine.map((m) => m.uci));
        const b = ensemble((data.moves || []).map((m) => m.uci));
        positionsVues++;
        coupsCompares += a.size;

        const manquants = diff(b, a);
        const enTrop = diff(a, b);
        if (manquants.length || enTrop.length) {
          problemes.push(
            `${depart.id} pas ${i} — ${fen}\n` +
            (manquants.length ? `    manquants chez nous : ${manquants.join(' ')}\n` : '') +
            (enTrop.length ? `    illégaux générés    : ${enTrop.join(' ')}\n` : '')
          );
        }

        if (!mine.length) break;                      // mat ou pat
        pos = mine[Math.floor(alea() * mine.length)].after;
      }
    }
  }

  console.log(`${positionsVues} positions comparées, ${coupsCompares} coups légaux confrontés à la tablebase.`);
  if (problemes.length) {
    console.log('\nDIVERGENCES :');
    problemes.forEach((p) => console.log('  ' + p));
    process.exit(1);
  }
  console.log('Aucune divergence.');
}

main().catch((e) => { console.error(e); process.exit(1); });
