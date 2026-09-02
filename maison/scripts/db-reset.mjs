// Repart d'une base locale vide : migrations puis seed.
// Ne touche jamais à la base distante — aucune commande n'a `--remote`.
import { rmSync } from 'node:fs';
import { wrangler } from './wrangler.mjs';

const LOCAL_D1_STATE = '.wrangler/state/v3/d1';

rmSync(LOCAL_D1_STATE, { recursive: true, force: true });
wrangler(['d1', 'migrations', 'apply', 'maison', '--local'], { stdio: 'inherit' });
console.log('\nJeton du foyer :');
wrangler(['d1', 'execute', 'maison', '--local', '--command', 'select display_token from household'], {
  stdio: 'inherit',
});
