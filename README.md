# Applications

Un dépôt, plusieurs petites applications web autonomes : **ni serveur, ni
dépendance, ni build**. Du HTML, du CSS et du JavaScript, servis tels quels par
GitHub Pages. Chacune s'installe sur l'écran d'accueil et fonctionne ensuite
hors ligne, toutes ses données restant sur l'appareil.

| Application | Ce que c'est | Dossier |
| --- | --- | --- |
| 🕵️ **Undercover** | Le jeu de bluff et de déduction, à plusieurs autour d'un seul téléphone. | [`undercover/`](undercover/) |
| ♜ **Coordonnées** | Entraînement aux coordonnées de l'échiquier : trouver, nommer, couleur — avec statistiques par case. | [`chess-coords/`](chess-coords/) |
| 🏠 **Maison** | Tâches ménagères d'un foyer de deux adultes : un écran mural en lecture seule, une interface téléphone. | [`maison/`](maison/) |

## 🌐 Publication

Le site est servi par **GitHub Pages** depuis la racine de la branche par
défaut. La page d'accueil (`index.html`) liste les applications, chaque
sous-dossier est servi à son propre chemin :

```
https://hector-mro.github.io/claudeapps/                 le portail
https://hector-mro.github.io/claudeapps/undercover/
https://hector-mro.github.io/claudeapps/chess-coords/
```

Pour activer la publication : **Settings → Pages → Source : Deploy from a
branch**, puis choisir la branche par défaut et le dossier `/ (root)`.

## ⚠️ Une exception : `maison/`

`maison/` ne suit pas les règles ci-dessous. C'est la seule application du
dépôt qui a un build (Vite) et une base de données : elle se déploie sur
**Cloudflare Workers + D1**, pas sur GitHub Pages, et n'est donc pas servie
depuis ce site. Son installation est décrite dans
[`maison/README.md`](maison/README.md).

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
