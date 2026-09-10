# Applications

Un dépôt, plusieurs petites applications web autonomes, chacune installable
sur l'écran d'accueil et fonctionnant ensuite hors ligne, toutes ses données
restant sur l'appareil. La plupart n'ont **ni serveur, ni dépendance, ni
build** : du HTML, du CSS et du JavaScript, servis tels quels par GitHub
Pages (voir les règles plus bas). `todo-app/` est l'exception « buildée » qui
reste servie sur ce même site — voir plus bas.

| Application | Ce que c'est | Dossier |
| --- | --- | --- |
| 🕵️ **Undercover** | Le jeu de bluff et de déduction, à plusieurs autour d'un seul téléphone. | [`undercover/`](undercover/) |
| ♜ **Coordonnées** | Entraînement aux coordonnées de l'échiquier : trouver, nommer, couleur — avec statistiques par case. | [`chess-coords/`](chess-coords/) |
| 🍃 **Tâches** | Liste de tâches sobre avec échéances, difficulté et une pointe de progression (série de jours, niveau). | [`todo-app/`](todo-app/) |
| 🏠 **Maison** | Tâches ménagères d'un foyer de deux adultes : un écran mural en lecture seule, une interface téléphone. | [`maison/`](maison/) |

## 🌐 Publication

Le site est servi par **GitHub Pages**, source **GitHub Actions**
([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)).
À chaque push sur la branche par défaut, le workflow copie `index.html`,
`.nojekyll`, `undercover/` et `chess-coords/` tels quels, build `todo-app/`
avec Vite, puis publie l'ensemble :

```
https://hector-mro.github.io/claudeapps/                 le portail
https://hector-mro.github.io/claudeapps/undercover/
https://hector-mro.github.io/claudeapps/chess-coords/
https://hector-mro.github.io/claudeapps/todo-app/
```

Pour activer la publication : **Settings → Pages → Source : GitHub Actions**.

## ⚠️ Deux exceptions

- **`todo-app/`** est une application React + Vite (voir
  [`todo-app/CLAUDE.md`](todo-app/CLAUDE.md)). Contrairement aux autres, son
  code source n'est pas servi tel quel : le workflow ci-dessus le build et
  publie sa sortie (`dist/`) à `todo-app/`. Elle garde son propre
  `manifest.webmanifest` et `sw.js` (générés dans `public/`, copiés par Vite),
  donc elle s'installe et fonctionne hors ligne comme les autres.
- **`maison/`** ne suit pas les règles ci-dessous. C'est la seule application
  du dépôt qui a une base de données : elle se déploie sur **Cloudflare
  Workers + D1**, pas sur GitHub Pages, et n'est donc pas servie depuis ce
  site. Son installation est décrite dans [`maison/README.md`](maison/README.md).

## 🧱 Règles du dossier

- **Une application = un sous-dossier**, avec son `index.html`, son
  `manifest.webmanifest`, son `sw.js`, ses `assets/` et ses `icons/`.
- **Uniquement des chemins relatifs** (`./assets/…`) : une application doit
  fonctionner à n'importe quel chemin, ouverte depuis un fichier local comme
  depuis GitHub Pages.
- **Pas de service worker à la racine.** Sa portée couvrirait tout le site et
  il intercepterait les requêtes des autres applications ; chaque service
  worker reste dans le dossier de son application, où sa portée est limitée.
- Le fichier `.nojekyll` désactive le traitement Jekyll : les fichiers sont
  publiés tels quels.

## ➕ Ajouter une application

1. Créer le sous-dossier et y placer l'application complète.
2. Ajouter sa carte dans `index.html` et sa ligne dans le tableau ci-dessus.
3. Pousser sur la branche par défaut : Pages redéploie tout seul.
