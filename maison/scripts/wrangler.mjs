// Appel de Wrangler depuis un script Node, sur les trois systèmes.
//
// Passer par `npx` ne marche pas : sous Windows c'est `npx.cmd`, et
// `execFileSync` refuse d'exécuter un .cmd sans shell — l'erreur remonte en
// ENOENT, qu'on interprète alors de travers. Passer par un shell résoudrait
// l'exécution mais casserait la citation des commandes SQL.
//
// On lance donc directement le point d'entrée JS de Wrangler avec le Node
// courant. `wrangler/bin/wrangler.js` n'est pas exposé par les `exports` du
// paquet : on résout son package.json, qui l'est, et on compose le chemin.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const BIN = join(dirname(require.resolve('wrangler/package.json')), 'bin', 'wrangler.js');

export function wrangler(args, options = {}) {
  return execFileSync(process.execPath, [BIN, ...args], { encoding: 'utf8', ...options });
}

/**
 * Wrangler intercale parfois une bannière ou un avis de mise à jour avant le
 * JSON demandé. On repart du premier crochet plutôt que de faire confiance à
 * la première ligne.
 */
export function wranglerJson(args) {
  const output = wrangler(args);
  const start = output.search(/[[{]/);
  if (start === -1) throw new Error('Réponse inattendue de Wrangler :\n' + output);
  return JSON.parse(output.slice(start));
}
