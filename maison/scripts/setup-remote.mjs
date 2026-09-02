// Prépare la base D1 distante : création, inscription de son identifiant dans
// wrangler.jsonc, puis migrations et seed. À lancer une seule fois, avant le
// premier `npm run deploy`.
//
// Le script est idempotent : relancé, il retrouve la base existante et
// n'applique que les migrations manquantes.
import { readFileSync, writeFileSync } from 'node:fs';
import { wrangler, wranglerJson } from './wrangler.mjs';

const CONFIG = 'wrangler.jsonc';
const DATABASE = 'maison';

function step(message) {
  console.log('\n→ ' + message);
}

/**
 * `d1 list` échoue si Wrangler n'est pas connecté, mais aussi si la base
 * n'existe simplement pas encore. On ne diagnostique donc rien ici : en cas
 * d'échec on renvoie null, et c'est `d1 create` — dont la sortie est affichée
 * telle quelle — qui dira ce qui ne va pas.
 */
function findDatabaseId() {
  try {
    const databases = wranglerJson(['d1', 'list', '--json']);
    const found = databases.find((database) => database.name === DATABASE);
    return found ? found.uuid : null;
  } catch {
    return null;
  }
}

try {
  step('Base D1');
  let id = findDatabaseId();
  if (id === null) {
    wrangler(['d1', 'create', DATABASE], { stdio: 'inherit' });
    id = findDatabaseId();
  }
  if (id === null) {
    throw new Error("La base n'a pas pu être créée ni retrouvée.");
  }
  console.log('  ' + DATABASE + ' = ' + id);

  step('Identifiant inscrit dans ' + CONFIG);
  const config = readFileSync(CONFIG, 'utf8');
  const updated = config.replace(/("database_id"\s*:\s*")[^"]*(")/, '$1' + id + '$2');
  if (updated === config) {
    console.log('  déjà à jour');
  } else {
    writeFileSync(CONFIG, updated);
    console.log('  écrit — pense à committer ce fichier');
  }

  step('Migrations et seed sur la base distante');
  wrangler(['d1', 'migrations', 'apply', DATABASE, '--remote'], { stdio: 'inherit' });

  step('Jeton du foyer');
  const rows = wranglerJson([
    'd1', 'execute', DATABASE, '--remote', '--json',
    '--command', 'select display_token from household',
  ]);
  const token = rows[0].results[0].display_token;

  console.log('\n  ' + token + '\n');
  console.log('Il reste à déployer :\n');
  console.log('  npm run deploy\n');
  console.log("Wrangler affichera l'adresse du Worker. Les trois adresses seront :\n");
  console.log('  https://<adresse>/app/' + token + '   le téléphone');
  console.log('  https://<adresse>/mur/' + token + '   le mur');
  console.log('  https://<adresse>/sonde.html   la sonde tablette\n');
} catch (error) {
  console.error('\nÉchec : ' + (error instanceof Error ? error.message : String(error)));
  console.error("\nSi Wrangler n'est pas connecté : npx wrangler login");
  process.exit(1);
}
