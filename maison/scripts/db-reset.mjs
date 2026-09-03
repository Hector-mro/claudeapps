// Repart d'une base locale vide : migrations puis seed.
// À n'utiliser qu'en local — le script refuse de toucher à distance.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const LOCAL_D1_STATE = '.wrangler/state/v3/d1';

function wrangler(...args) {
  execFileSync('npx', ['wrangler', ...args], { stdio: 'inherit' });
}

rmSync(LOCAL_D1_STATE, { recursive: true, force: true });
wrangler('d1', 'migrations', 'apply', 'maison', '--local');
console.log('\nJeton du foyer :');
wrangler('d1', 'execute', 'maison', '--local', '--command', 'select display_token from household');
