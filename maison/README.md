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
| 4 | Revue hebdomadaire | à venir |
| 2 | Écran mural, compatible tablette ancienne | à venir |
| 5 | Déploiement Cloudflare | à venir |

L'ordre a été inversé après le jalon 1 : l'application a de la valeur sur le
seul téléphone, donc le mur n'est plus le point de risque qui doit passer en
premier. Il reste au programme — et sert aussi à décider si un TRMNL vaudrait
l'achat.

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
depuis la tablette :

```bash
npm run build
npm run serve:lan          # écoute sur 0.0.0.0:4173
```

Puis, sur la tablette, ouvrir `http://<ip-du-portable>:4173/sonde.html`.
L'adresse à utiliser :

```bash
hostname -I | awk '{print $1}'      # Linux
ipconfig getifaddr en0              # macOS
```

La tablette et le portable doivent être sur le même réseau — donc, ici,
tous les deux sur le partage de connexion du téléphone.

> `vite preview` ne sert que le front. Pour un test complet avec l'API,
> lancer `npm run build && npx wrangler dev --ip 0.0.0.0 --port 8787` et
> ouvrir `http://<ip-du-portable>:8787/`.

### Mise en veille

L'écran mural demandera un `navigator.wakeLock` quand l'API existe, avec
réacquisition après un `visibilitychange`. Sur une tablette ancienne cette API
peut être absente : le repli est silencieux, mais il faut alors **régler la
mise en veille dans les réglages système de la tablette** (Affichage → Veille →
Jamais), sinon l'écran s'éteindra malgré tout. La sonde indique si l'API est
disponible.

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
flexbox, `aspect-ratio`, nesting natif, `color-mix()`, `oklch()`.
Interdits en JS : optional chaining non transpilé, `structuredClone`,
`Array.at()`, `Object.hasOwn`, top-level await.

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
