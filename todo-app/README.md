# Tâches (todo-app)

Liste de tâches en trois zones — Hector, Nina, Commun — avec échéances,
difficulté et une pointe de progression. L'app est servie par GitHub Pages ;
ses données peuvent être partagées entre appareils grâce à une petite API
Cloudflare (`worker/`). Détails techniques : [`CLAUDE.md`](CLAUDE.md).

| | Adresse |
| --- | --- |
| L'app | https://hector-mro.github.io/claudeapps/todo-app/ |
| L'API | https://taches-api.lacaille.workers.dev |
| Santé de l'API | https://taches-api.lacaille.workers.dev/api/health |

## Partager entre appareils

Sans code d'accès, l'app fonctionne comme avant : tout reste sur l'appareil.
Avec le code, les trois zones sont synchronisées.

- **Le plus simple** : ouvrir une fois
  `https://hector-mro.github.io/claudeapps/todo-app/#cle=<code>`. Le code est
  mémorisé, puis retiré de la barre d'adresse.
- **App installée sur l'écran d'accueil d'un iPhone** : elle ne voit pas ce
  que Safari a mémorisé. Sur l'écran des zones, toucher « Se connecter » et
  taper le code une fois.
- Au premier branchement, les tâches déjà présentes sur l'appareil sont
  envoyées et fusionnées avec celles du serveur : rien n'est perdu.

La ligne sous les zones dit où on en est : « Synchronisé »,
« Synchronisation… », « Hors ligne — les changements partiront au retour du
réseau », « Code d'accès refusé ».

**Quand les changements circulent.** Les siens partent moins d'une seconde
après chaque modification. Ceux de l'autre arrivent à l'ouverture de l'app et
à chaque retour au premier plan — pas de rafraîchissement en direct.

**Hors ligne**, tout reste modifiable : les changements sont gardés (même si
l'app est fermée) et partent au retour du réseau.

**Conflits.** Si les deux modifient la même tâche, la dernière modification
envoyée l'emporte. Une tâche supprimée le reste, même si l'autre téléphone
renvoie plus tard une modification faite hors ligne.

### Il n'y a pas de mot de passe

Le code est le seul secret : qui l'a peut tout lire et tout modifier. Il
voyage dans un en-tête, jamais dans une URL envoyée au serveur (le `#cle=`
reste dans le navigateur). Un code faux reçoit un `404`, comme une adresse
qui n'existe pas.

Changer le code (lien envoyé au mauvais endroit, téléphone perdu) :

```bash
npx wrangler secret put ACCESS_KEY    # coller le nouveau code
```

Les appareils affichent alors « Code d'accès refusé » : toucher « Changer de
code » et taper le nouveau.

## Déploiement

**Le front** se déploie tout seul : chaque push sur `main` le rebuild et le
publie sur Pages (`.github/workflows/deploy-pages.yml`). Son adresse d'API
vient de `.env.production`.

**L'API** se déploie à la main, depuis `todo-app/`, seulement quand `worker/`
ou `migrations/` changent :

```bash
npm run db:migrate:remote   # seulement s'il y a une nouvelle migration
npm run worker:deploy
```

Mise en place initiale, pour mémoire : `npx wrangler login`, puis
`npx wrangler d1 create taches` (son id va dans `wrangler.jsonc`, committé),
`npm run db:migrate:remote`, `npx wrangler secret put ACCESS_KEY`,
`npm run worker:deploy`.

Le palier gratuit de Cloudflare suffit très largement : quelques dizaines de
requêtes par jour pour deux personnes, contre 100 000 autorisées.

## Développement local

```bash
npm install
npm run db:migrate:local   # une fois : la base D1 locale
npm run worker:dev         # l'API sur http://127.0.0.1:8787
npm run dev                # l'app sur http://localhost:5173
```

Il faut un fichier `.dev.vars` (ignoré par git) :

```
ACCESS_KEY=dev
ALLOWED_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Puis ouvrir `http://localhost:5173/#cle=dev`. Une fenêtre normale et une
fenêtre privée font deux téléphones.

Tests, lint, build : `npm test`, `npm run lint`, `npm run build`.

## Plus tard : les notifications

L'architecture est prête, rien n'est encore construit. La base garde
l'échéance, l'état et la zone de chaque tâche en vraies colonnes : un
déclencheur planifié du Worker (cron) peut y chercher les tâches dues et
envoyer une notification Web Push, reçue par `public/sw.js`. Sur iPhone, les
notifications web demandent que l'app soit installée sur l'écran d'accueil.
