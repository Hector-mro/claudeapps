# Maison

Gestion des tâches ménagères pour deux adultes, sur deux surfaces :

- **`/mur/:token`** — un écran posé dans le salon, en lecture seule, qui affiche
  au plus cinq choses à faire aujourd'hui. Aucune interaction.
- **`/app/:token`** — le téléphone : cocher, repousser, ajouter, et la revue
  hebdomadaire.

Le but n'est pas de tenir une liste. Le but est de sortir des deux têtes le
travail d'anticipation (« il faudrait penser à… ») et de surveillance
(« est-ce que ça a été fait ? »). Aucune notification, aucun score, aucun
classement — voir `SPEC.md` pour les principes qui tranchent les arbitrages.

> **Exception dans ce dépôt.** Les autres applications de `claudeapps` sont du
> HTML servi tel quel par GitHub Pages. Celle-ci a un build et une base de
> données : elle se déploie sur Cloudflare Workers + D1 et n'est pas publiée
> par Pages.

## État

| Jalon | Contenu | Statut |
| --- | --- | --- |
| 1 | Schéma D1, migrations, seed, `GET /api/today` | ✅ |
| 3 | Interface téléphone : cocher, repousser, ajouter | ✅ |
| 4 | Revue hebdomadaire | ✅ |
| 2 | Écran mural, compatible tablette ancienne | ✅ |
| 5 | Déploiement Cloudflare, README d'installation | ✅ |

L'ordre a été inversé après le jalon 1 : l'application a de la valeur sur le
seul téléphone, donc le mur n'est plus le point de risque qui doit passer en
premier. Il sert aussi à décider si un TRMNL vaudrait l'achat.

## Installation

Une seule fois, sur ta machine. Il faut un compte Cloudflare — le palier
gratuit suffit très largement, voir « Quotas » plus bas.

```bash
cd maison
npm install
npx wrangler login       # ouvre le navigateur
npm run setup:remote     # crée la base D1, écrit son id, migre, sème
npm run deploy
```

`setup:remote` affiche le **jeton du foyer** : trente-deux caractères tirés au
hasard, générés dans la base au moment du seed. `deploy` affiche l'adresse du
Worker. Les deux ensemble donnent les trois adresses à garder :

```
https://<adresse>/app/<jeton>     le téléphone   → signet, écran d'accueil
https://<adresse>/mur/<jeton>     le mur         → la tablette, en plein écran
https://<adresse>/sonde.html      la sonde       → diagnostic tablette
```

`setup:remote` modifie `wrangler.jsonc` pour y inscrire l'identifiant de la
base : **committe ce fichier**, sinon le prochain déploiement repartira sur
une base vide.

Relire le jeton plus tard : `npm run db:token:remote`.

### Il n'y a pas de mot de passe

L'accès tient au jeton dans l'URL, et à rien d'autre. Ce qui en découle :

- **Le lien est le secret.** Qui l'a peut tout lire et tout cocher. C'est
  volontaire : demander un mot de passe à quelqu'un qui traverse le couloir
  avec les bras chargés, c'est garantir que l'application ne servira pas.
- Un jeton inconnu renvoie `404`, jamais `403` : inutile de confirmer qu'il y
  a quelque chose derrière l'adresse.
- `robots.txt`, `<meta name="robots">` et l'en-tête `X-Robots-Tag` interdisent
  l'indexation ; `Referrer-Policy: no-referrer` empêche le jeton de fuir par
  un en-tête `Referer`.
- Pour le changer (lien envoyé au mauvais fil de discussion, tablette
  revendue) :

  ```bash
  npx wrangler d1 execute maison --remote \
    --command "update household set display_token = lower(hex(randomblob(16)))"
  npm run db:token:remote
  ```

  Les anciens liens tombent en `404` dans la seconde. Il faut alors mettre à
  jour les signets et l'onglet de la tablette.

### Mettre à jour

```bash
npm run deploy
```

Une migration en attente s'applique séparément, **avant** le déploiement du
code qui en dépend :

```bash
npm run db:migrate:remote
npm run deploy
```

Le mur ne recharge pas la page de lui-même : il tourne des semaines sur le
même bundle. Il se recharge donc tout seul à 4 h du matin, ce qui suffit à ce
qu'un déploiement finisse par arriver jusqu'à lui sans traverser le salon.

### Poser la tablette

1. Ouvrir `https://<adresse>/sonde.html`, lire la ligne `navigator.wakeLock`.
2. Ouvrir `https://<adresse>/mur/<jeton>`, puis « Ajouter à l'écran d'accueil »
   (le mode plein écran retire la barre d'adresse).
3. Si la sonde dit que `wakeLock` est absent : **Réglages → Affichage → Veille
   → Jamais**. Sans ça, l'écran s'éteindra malgré tout.
4. Brancher sur secteur — le mur interroge l'API en continu.

## Développement local

```bash
npm install
npm run db:reset     # base locale vide → migrations → seed, et affiche le jeton
npm run worker       # l'API sur http://127.0.0.1:8787
npm run dev          # le front sur http://127.0.0.1:5173, /api proxyfié vers 8787
```

`npm run db:reset` termine en affichant le `display_token` du foyer. Il ouvre
les deux surfaces :

```
http://127.0.0.1:5173/mur/<token>
http://127.0.0.1:5173/app/<token>
```

Relire le jeton plus tard : `npm run db:token`.

### Vérifier le contenu servi au mur

```bash
curl -s http://127.0.0.1:8787/api/<token>/today | python3 -m json.tool
```

## Tester sur la tablette du salon

La tablette est le point de risque du projet : une page blanche là-bas est un
échec complet, et il n'y a pas de console pour comprendre pourquoi. Deux
outils.

**1. La sonde.** `public/sonde.html` est écrite en ES5, sans build ni
dépendance : c'est le seul fichier censé s'afficher même si tout le reste
échoue. Elle liste ce que le navigateur de la tablette sait réellement faire
(syntaxe JS, propriétés CSS, `wakeLock`, accès à l'API) et tente un appel réel
à `/api/health`.

**2. Servir le build sur le réseau local**, pour ouvrir la vraie application
depuis la tablette avant même d'avoir déployé :

```bash
npm run serve:lan          # build, puis écoute sur 0.0.0.0:8787
```

Cette commande sert le front **et** l'API sur la base locale : c'est un test
complet, contrairement à un simple serveur de fichiers. Trouver l'adresse de
la machine :

```bash
hostname -I | awk '{print $1}'      # Linux
ipconfig getifaddr en0              # macOS
```

Puis, sur la tablette :

```
http://<ip-de-la-machine>:8787/sonde.html
http://<ip-de-la-machine>:8787/mur/<jeton local>
```

La tablette et la machine doivent être sur le même réseau — donc, ici, toutes
les deux sur le partage de connexion du téléphone.

### Mise en veille

L'écran mural demandera un `navigator.wakeLock` quand l'API existe, avec
réacquisition après un `visibilitychange`. Sur une tablette ancienne cette API
peut être absente : le repli est silencieux, mais il faut alors **régler la
mise en veille dans les réglages système de la tablette** (Affichage → Veille →
Jamais), sinon l'écran s'éteindra malgré tout. La sonde indique si l'API est
disponible.

## Écran mural

`/mur/:token`. Lecture seule : aucun bouton, aucun défilement, aucune
rotation d'écrans. Une requête toutes les 60 secondes.

**Le plafond de cinq est codé en dur** (`WALL_MAX`). Au-delà, « +N », sans
lister. Une tâche en retard de plus de sept jours est déjà passée dans
« Ça a glissé » côté API : elle n'apparaît jamais deux fois.

**Aucun marqueur de retard dans « Aujourd'hui ».** La spec énumère ce que
porte chaque ligne — déclencheur, titre, prénom — puis dit « rien d'autre ».
Un « en retard depuis 3 jours » ajouterait de la culpabilité sans ajouter
d'action : le tri suffit à les faire remonter. Le nombre de jours n'apparaît
que dans « Ça a glissé », où c'est précisément le sujet.

**Pas de titre « Aujourd'hui ».** La ligne de contexte dit déjà « mardi
1 septembre » ; un intertitre juste en dessous ne dirait rien et coûterait
une ligne sur un écran qui doit tenir sans défiler.

### Tenir dans l'écran sans rien couper

Un mur ne défile pas : ce qui dépasse est simplement invisible, et personne
ne s'en aperçoit. Cinq tâches **plus** la section « Ça a glissé » débordent
d'un 1280×800 aux tailles nominales — le premier jet coupait la section en
silence.

La page mesure donc son propre contenu après chaque changement (et après
chaque rotation) et réduit la typographie par paliers de 4 % jusqu'à ce que
tout tienne. Le plancher n'est pas une constante : il se déduit de la seule
règle qui compte, **un titre ne descend jamais sous 40 px**.

| Écran | Échelle | Titre | Déborde |
| --- | --- | --- | --- |
| 1280×800, cas courant | 1.00 | 50 px | non |
| 1280×800, 5 tâches + 3 glissées | 0.84 | 41 px | non |
| 800×1280 | 1.00 | 50 px | non |
| 1024×600 (7 pouces) | 0.89 | 40 px | **oui** |

Sur un écran plus court qu'une tablette 10 pouces, les deux exigences se
contredisent : la lisibilité l'emporte et le bas de l'écran est rogné.

Le déclencheur est limité à **une ligne**, avec ellipse au-delà. Un
déclencheur qui ne tient pas sur une ligne à trois mètres ne remplit pas son
office : « En rentrant du travail, avant de poser mon sac » fait 46 signes et
en laisse encore la place.

### Ne pas redessiner pour rien

Une signature est calculée sur ce qui est réellement affiché. Si elle n'a pas
changé, l'état React reste le même objet, React n'effectue aucun rendu, et le
DOM n'est pas touché. Mesuré avec un `MutationObserver` : **0 mutation après
trois rafraîchissements identiques**.

### Quand la connexion tombe

Le mur garde le dernier contenu connu — mieux vaut une liste d'il y a dix
minutes qu'un écran vide. Passé dix minutes sans réponse, une mention
minuscule apparaît en bas à droite : `hors ligne depuis 14:03`. C'est du
statut, pas du contenu ; sans elle, un partage de connexion tombé laisse un
mur qui affirme tranquillement qu'il n'y a rien à faire. Elle disparaît dès
que le réseau revient.

### Mise en veille et pannes

`navigator.wakeLock` est demandé au montage et réacquis à chaque
`visibilitychange` (le verrou est perdu dès que la page passe en
arrière-plan). Absent, le repli est silencieux — voir plus bas.

Un `ErrorBoundary` entoure le mur, et lui seul : une exception non attrapée
sur un écran que personne ne surveille resterait une page blanche. À la
place, une phrase sobre et un rechargement automatique une minute plus tard.

## Contraintes de compatibilité

Cibles de build : `safari >= 12, chrome >= 70` (`browserslist` dans
`package.json`, `@vitejs/plugin-legacy` dans `vite.config.ts`).

Deux pièges traités explicitement dans la configuration :

- Safari 12 sait charger `<script type="module">` : il prend donc le bundle
  « moderne », pas les chunks legacy. `modernTargets` transpile ce bundle
  moderne jusqu'aux mêmes cibles.
- `build.cssTarget` est fixé séparément : sans lui, le minifieur CSS émet de
  la syntaxe moderne que la tablette ignore en silence.

Interdits dans le CSS servi au mur : `:has()`, container queries, `gap` sur
flexbox, `aspect-ratio`, nesting natif, `color-mix()`, `oklch()`. S'y ajoutent,
par le même raisonnement, `inset`, `clamp()`, `min()` et `max()` — tous
postérieurs à Chrome 70. Les espacements du mur passent donc par des marges et
les tailles par `calc()`.

Interdits en JS : optional chaining non transpilé, `structuredClone`,
`Array.at()`, `Object.hasOwn`, top-level await.

**Vérifié sur les fichiers produits** (`dist/assets/`), moderne et legacy :

| | Occurrences |
| --- | --- |
| `:has()`, `@container`, `@layer`, nesting | 0 |
| `aspect-ratio`, `color-mix()`, `oklch()` | 0 |
| `clamp()`, `min()`, `max()`, `inset:` | 0 |
| `?.`, `??`, `.at(`, `Object.hasOwn`, `structuredClone` | 0 |

`gap` subsiste dans quelques règles, toutes issues de l'interface téléphone et
jamais appliquées au mur. Une **déclaration** inconnue est ignorée isolément
par les vieux moteurs ; seuls un sélecteur ou une at-rule inconnus feraient
tomber un bloc entier, et il n'y en a aucun.

## Modèle de données

`migrations/0001_init.sql`. Deux règles portées par le schéma lui-même :

- Une tâche `recurring` **doit** avoir un `trigger_cue` non vide et un
  `interval_days` : une récurrence sans déclencheur contextuel est une alarme,
  et la base la refuse.
- Le foyer est unique (`CHECK (id = 1)`) : pas de multi-foyers.

**Récurrence.** Quand une tâche `recurring` est cochée, on écrit une ligne dans
`completions` et `next_due_on` devient *date du jour + interval_days* — pas
échéance théorique + intervalle. Un retard d'une semaine ne doit pas produire
cinq tâches en retard d'un coup.

**Fuseau.** Le Worker tourne en UTC et SQLite ne connaît que l'UTC ; toutes les
dates de calendrier passent par `src/worker/dates.ts`. Sans ça, entre 22 h et
minuit l'été, le mur afficherait la liste de la veille.

## API

| Route | Effet |
| --- | --- |
| `GET /api/health` | vivant, sans jeton |
| `GET /api/:token/today` | contexte du jour, tâches dues, tâches qui ont glissé |
| `GET /api/:token/domains` | domaines actifs et leur propriétaire |
| `POST /api/:token/tasks/:id/complete` | coche ; récurrente replanifiée, ponctuelle retirée |
| `POST /api/:token/tasks/:id/skip` | repousse de 2 jours et écrit `skipped = 1` |
| `POST /api/:token/tasks` | ajoute une tâche ponctuelle due aujourd'hui |
| `DELETE /api/:token/completions/:id` | annule un « fait » ou un « repoussé » récent |
| `GET /api/:token/review` | comptes sur 7 jours, tâches qui résistent, domaines |
| `POST /api/:token/domains/:id/owner` | réassigne un domaine |
| `DELETE /api/:token/tasks/:id` | désactive une tâche (`active = 0`) |

Un jeton inconnu renvoie `404` et non `403` : inutile de confirmer à qui tombe
dessus qu'il y a quelque chose derrière l'adresse.

`today` est trié mais **non plafonné** : le mur en prend 5 et affiche « +N »,
le téléphone les prend toutes. Tri : les tâches en retard d'abord, puis par
échéance, puis l'effort faible avant l'effort élevé — un soir de fatigue doit
se voir proposer quelque chose de tenable.

Une tâche en retard de **plus de 7 jours** quitte `today` pour `slipped`
(3 au maximum). Elle n'apparaît pas dans les deux : une dette de trois semaines
n'est plus le plan du jour, et la laisser en tête des cinq lignes du mur
remplirait l'écran de reproches.

## Interface téléphone

Trois décisions qui ne sont pas dans la spec et qu'il faut valider :

- **Cocher, c'est toute la ligne ; ouvrir le détail, c'est la colonne « ⋯ ».**
  La spec dit « un tap coche » et décrit par ailleurs l'ouverture d'une tâche :
  il fallait deux zones. La zone de coche fait toute la largeur restante, celle
  d'ouverture fait 48 px.
- **Une annulation de sept secondes après chaque action.** Sans elle, un tap
  parti tout seul dans un couloir repousse « Courses de la semaine » de sept
  jours sans aucun moyen de revenir en arrière. La ligne `completions` mémorise
  l'échéance d'avant (`previous_next_due_on`, migration `0003`) : annuler
  restaure la date exacte au lieu de la recalculer. Le serveur refuse au-delà
  de cinq minutes, pour que la revue hebdomadaire ne soit pas réécrivable.
- **Une tâche ponctuelle ajoutée est marquée `effort = 'low'`.** Le formulaire
  ne demande qu'un titre et un domaine ; il fallait bien choisir quelque chose,
  et `low` la place tôt dans le tri.

« Repoussé » décale de deux jours **à partir d'aujourd'hui**, pas à partir de
l'échéance : une tâche déjà en retard ne doit pas rester en retard après avoir
été repoussée. C'est la même logique que la récurrence.

Une tâche ponctuelle cochée est désactivée (`active = 0`), pas supprimée : la
revue hebdomadaire a besoin de son historique.

## Revue hebdomadaire

`/app/:token/revue`, atteinte par l'entrée de menu en bas de la liste du jour,
et par une bannière le jour configuré (`weekly_review_weekday`, dimanche par
défaut).

Trois sections, dans cet ordre.

**Sept derniers jours.** Deux lignes, un prénom et un nombre. Rien d'autre :
pas de barre, pas d'écart, pas de tri par score, pas d'historique. Les lignes
sont ordonnées par identifiant de personne, jamais par nombre de tâches — un
classement, même involontaire, transforme le foyer en comptabilité.

**Ça résiste.** Les tâches repoussées **au moins deux fois d'affilée**. Les
reports sont comptés *depuis la dernière réalisation* et non depuis toujours :
trois reports étalés sur deux ans ne disent rien, trois reports d'affilée sans
que la tâche ait jamais été faite disent tout. À partir de trois, la revue
propose explicitement de la retirer.

Retirer, c'est `active = 0`, pas un `DELETE` : les semaines passées doivent
rester lisibles.

**Domaines.** Chaque domaine porte son standard minimum et une bascule à deux
positions pour son propriétaire. La réassignation se fait **ici et uniquement
ici** : jamais au niveau d'une tâche isolée, qui recréerait la charge mentale
qu'on cherche à supprimer.

## Quotas Cloudflare

Un mur qui interroge l'API toutes les 60 secondes, toute la journée, consomme
environ **1 440 requêtes par jour**.

| | Palier gratuit | Usage estimé |
| --- | --- | --- |
| Workers, requêtes | 100 000 / jour | ~1,5 % |
| Workers, CPU | 10 ms / requête | une lecture indexée, très en deçà |
| D1, lignes lues | 5 000 000 / jour | ~1 % (index `idx_tasks_due`) |
| D1, lignes écrites | 100 000 / jour | quelques dizaines |
| D1, stockage | 5 Go | quelques dizaines de Ko |

Aucune limite ne pose problème. Le point de vigilance n'est pas Cloudflare mais
le forfait mobile : sans wifi, la tablette passe par un partage de connexion,
soit de l'ordre de **3 Mo par jour**, ~90 Mo par mois.

Depuis le 1ᵉʳ septembre 2026, D1 renvoie des erreurs au lieu de dégrader quand
le quota journalier est dépassé — hors de portée à cette échelle.
