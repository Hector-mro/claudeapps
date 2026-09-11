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
VAPID_PUBLIC_KEY=<clé publique de dev>
VAPID_PRIVATE_KEY=<clé privée de dev>
```

(Une paire de dev, via `node scripts/vapid-keys.mjs` ; sa clé publique est
aussi `VITE_VAPID_PUBLIC_KEY` dans `.env.development`.)

Puis ouvrir `http://localhost:5173/#cle=dev`. Une fenêtre normale et une
fenêtre privée font deux téléphones.

Pour les notifications : Chrome sur ordinateur les reçoit aussi depuis
`localhost`. Lancer l'API avec `npx wrangler dev --test-scheduled`, puis
`curl http://127.0.0.1:8787/__scheduled` fait un passage du cron sans
attendre.

Tests, lint, build : `npm test`, `npm run lint`, `npm run build`.

## Notifications

Sur iPhone, l'app installée sur l'écran d'accueil reçoit de vraies
notifications : écran verrouillé, bannière, et un chiffre sur l'icône. Il faut
iOS 16.4 ou plus, et le code d'accès (le serveur ne connaît que les tâches
synchronisées).

**Les activer** : ouvrir l'app *depuis l'écran d'accueil*, toucher
« Activer les notifications » sur l'écran des zones, choisir qui on est
(Hector ou Nina), puis « Autoriser ». Une notification « Notifications
activées ✓ » arrive aussitôt. Dans Safari, hors de l'app installée, la ligne
invite à ajouter l'app à l'écran d'accueil.

Chaque téléphone reçoit ce qui concerne sa zone et Commun :

- **Un rappel 1 h avant chaque échéance** (« Payer le loyer — À 14:30 ·
  Commun »). Un seul par tâche ; si l'échéance change, un nouveau rappel
  partira. Une tâche créée déjà en retard n'en reçoit pas.
- **Le programme du jour, vers 8 h** : les tâches prévues aujourd'hui qui
  restent à venir — jamais les retards. Rien ne part les jours où rien n'est
  prévu.
- **Le chiffre sur l'icône** : les tâches du jour et en retard. Il se met à
  jour à l'ouverture de l'app et à chaque notification : iOS ne permet pas de
  le changer autrement.

Le serveur regarde toutes les 5 minutes (déclencheur planifié du Worker) : un
rappel peut arriver jusqu'à 5 minutes après l'heure « 1 h avant ».

**Les couper** : « Désactiver » sur l'écran des zones, ou Réglages ›
Notifications › Tâches. Des notifications refusées ne se réautorisent que
dans les Réglages.

### Mise en place (une fois)

Les notifications sont signées par une paire de clés VAPID :

```bash
node scripts/vapid-keys.mjs   # affiche une nouvelle paire
```

La clé publique va dans `wrangler.jsonc` (`VAPID_PUBLIC_KEY`) et dans
`.env.production` (`VITE_VAPID_PUBLIC_KEY`), la clé privée seulement dans le
secret du Worker :

```bash
npx wrangler secret put VAPID_PRIVATE_KEY   # coller la clé privée
npm run db:migrate:remote
npm run worker:deploy
```

Changer de paire oblige chaque téléphone à réactiver les notifications.
