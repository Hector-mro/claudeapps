# ♜ Coordonnées

Entraînement aux **coordonnées de l'échiquier**, mobile-first et hors ligne.
Deux exercices symétriques, un chrono, des pénalités, et des statistiques
case par case qui savent exactement où ça coince.

## 🎯 Les trois exercices

**1 — Trouver la case.** Une coordonnée s'affiche (`e4`), il faut toucher la
case correspondante. Le plus de cases possible dans le temps imparti.

**2 — Nommer la case.** Une case est surlignée, il faut taper sa coordonnée
au pavé tactile (ou au clavier physique). L'exercice inverse.

**3 — Couleur de la case.** Une coordonnée s'affiche, il faut répondre
**blanche ou noire** le plus vite possible. Ici **aucun échiquier n'est
affiché** — le damier donnerait la réponse — et le temps de réaction s'affiche
après chaque bonne réponse. Deux grands boutons sous le pouce, touches `B` et
`N` au clavier.

Dans les deux premiers, l'échiquier est en **position de départ**, présenté du
côté des blancs ou des noirs **au hasard**, et **jamais** bordé des lettres et
des chiffres : c'est bien la mémoire des coordonnées qui travaille.

## 🚀 Lancer

Ouvrez `index.html` dans un navigateur. Pour l'installer comme une vraie
application (plein écran, hors ligne), servez le dossier en HTTP puis utilisez
« Ajouter à l'écran d'accueil » :

```bash
npx http-server -p 8080 ..   # puis http://localhost:8080/chess-coords/ sur le téléphone
```

## ✨ Fonctionnalités

**Série**
- Durée au choix : 30 s, 1 min, 1,5 min ou 2 min, décompte de départ à 3.
- **Pénalité par erreur** réglable (0 à 5 secondes retirées au chrono), avec
  option « l'erreur coûte aussi un point ».
- Après une faute, la case demandée **reste affichée** : on cherche jusqu'à
  la trouver, l'erreur ne se contourne pas.
- Une faute compte **contre les deux cases** : celle qui était demandée et
  celle qui a été désignée à sa place. Confondre `e4` et `d4`, c'est mal
  connaître les deux. Vaut au clic comme à la saisie ; l'exercice de couleur,
  lui, n'a pas de seconde case à mettre en cause.
- L'écran de fin nomme les confusions telles quelles : `e4 → d4`.
- Score, série en cours, temps de la dernière réponse, cadence par minute et
  record par exercice.

**Échiquier**
- Côté blancs, côté noirs, ou **tiré au sort** à chaque série.
- **Retournement en cours de série** : jamais, toutes les 10 / 5 / 3 cases, ou
  au hasard. L'échiquier pivote sous les yeux et le temps de l'animation est
  rendu au joueur.
- Pièces en position de départ (désactivables pour un échiquier nu).
- Aucune coordonnée affichée, y compris pour les lecteurs d'écran.
- Ces trois réglages ne concernent pas l'exercice « couleur de la case », qui
  se joue sans échiquier ; tous les autres (durée, pénalité, cases faibles,
  sons, thème) s'appliquent aux trois exercices.

**Échiquier de référence** (hors exercice)
- Un échiquier qu'on peut simplement **regarder**, sans lancer de série : pour
  ancrer une remarque, vérifier une diagonale, se refaire l'œil.
- **Coordonnées affichées** en bordure — le seul endroit de l'application où
  elles apparaissent sur un échiquier.
- Touchez une case : son nom, sa couleur, et ce que les exercices en disent
  (maîtrise, réussites, ratées, fois où elle a été désignée à tort, temps moyen).
- **Guides** : la ligne et la colonne de la case touchée sont soulignées, pour
  voir comment la coordonnée se construit.
- **Retournement** d'un bouton, **pièces** de départ affichables ou non, et
  **maîtrise superposée** : les 64 cases prennent les teintes du damier de
  chaleur, sur le vrai échiquier et du côté qu'on veut.
- Chaque réglage est mémorisé.

**Statistiques**
- **Maîtrise case par case**, notée sur la précision (60 %) et la rapidité
  (40 %), tempérée tant que les essais sont peu nombreux — une case vue deux
  fois n'est pas encore « maîtrisée ».
- Deux compteurs de faute distincts, qui pèsent l'un comme l'autre sur la
  note : **ratée** (la case était demandée et n'a pas été trouvée) et
  **cliquée à tort** (elle a été désignée à la place d'une autre). Une case
  jamais demandée mais souvent cliquée par erreur descend donc, elle aussi,
  dans les cases à travailler.
- Damier de chaleur des 64 cases, détail au toucher : réussites, précision,
  les deux compteurs de faute, temps moyen.
- Classements « à travailler » et « maîtrisées », filtrables par exercice
  (tout, trouver, nommer, couleur) : une case peut être sûre à la désignation
  et hésitante à la couleur.
- Historique des dernières séries.

**Mode « cases faibles »**
- Le tirage cesse d'être uniforme et vise les cases mal maîtrisées : dans un
  profil où 8 cases sur 64 sont fragiles, elles sortent près de 6 fois sur 10
  au lieu de 1 sur 8. Les cases jamais rencontrées passent devant les cases
  déjà solides.

**Confort**
- De l'iPhone SE à la tablette : l'échiquier prend toute la place disponible,
  jamais de défilement pendant un exercice.
- Sons, vibrations, écran maintenu allumé, thème papier ou encre de nuit.
- **PWA installable et 100 % hors ligne**, tout est gardé en local.

## 🎨 Direction artistique

Celle du dossier : papier grainé, encre noire, titres en romain et libellés en
machine à écrire. Trois couleurs de signalisation seulement — **bleu** pour la
case cible, **vert** pour la bonne réponse, **rouge tampon** pour la faute — et
un damier de chaleur qui va du rouge au vert pour la maîtrise.

## 📁 Structure

```
index.html               les cinq écrans
assets/styles.css        direction artistique et mise en page mobile
assets/store.js          réglages, statistiques par case, historique (localStorage)
assets/board.js          cases, orientation, pièces, maîtrise, tirage des cibles
assets/app.js            interface, moteur des trois exercices, statistiques
manifest.webmanifest     installation PWA
sw.js                    cache hors ligne
icons/                   icônes de l'application
```

Aucune dépendance, aucun build : du HTML, du CSS et du JavaScript.
