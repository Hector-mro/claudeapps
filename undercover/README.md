# 🕵️ Undercover

Une version web **mobile-first** du jeu de bluff *Undercover*, pensée pour être jouée
à plusieurs autour d'**un seul téléphone**. Aucune installation, aucun compte, aucun
réseau : tout tourne dans le navigateur et fonctionne hors ligne.

## 🎯 Le principe

Tous les civils reçoivent le **même mot**. Les undercover en reçoivent un **très
proche** (`Fraise` / `Framboise`). Mr White ne reçoit **rien** et doit bluffer.
Chacun décrit son mot sans jamais le prononcer, puis tout le monde vote pour
éliminer un suspect.

- **Civils** — éliminer tous les imposteurs.
- **Undercover** — survivre jusqu'à être aussi nombreux que les civils.
- **Mr White** — gagner comme les undercover, ou deviner le mot des civils au moment d'être démasqué.

## 🚀 Lancer le jeu

Ouvrez simplement `index.html` dans un navigateur. Pour l'installer comme une vraie
application (plein écran, hors ligne), servez le dossier en HTTP puis utilisez
« Ajouter à l'écran d'accueil » :

```bash
npx http-server -p 8080 ..   # puis http://localhost:8080/undercover/ sur le téléphone
```

## ✨ Fonctionnalités

**Contenu**
- **173 paires de mots** en français, réparties en 14 catégories (nourriture, animaux,
  objets, lieux, sports, métiers, nature, transports, corps, culture, vêtements,
  technologie, idées, fêtes).
- Chaque paire est **symétrique** : n'importe lequel des deux mots peut être celui
  des civils ou celui de l'undercover, tiré au sort à chaque manche.
- 3 niveaux de difficulté (`Facile` / `Moyen` / `Corsé`) selon la proximité des deux mots.
- Sélection des catégories, mémoire des paires déjà jouées pour éviter les répétitions.
- **Mots personnalisés** : créez vos propres paires, avec import / export en un copier-coller.

**Rôles & mise en place**
- 3 à 20 joueurs, noms et avatars personnalisables.
- Nombre d'**undercover** et de **Mr White** libre, ou **répartition automatique** conseillée.
- Option « prévenir l'undercover » (il sait qu'il a le mot différent) ou mode aveugle.

**Déroulé d'une manche**
- Distribution en se passant le téléphone, avec option **« maintenir appuyé pour voir »**
  et ordre de distribution aléatoire.
- Ordre de parole tiré au sort, option **Mr White jamais premier orateur**.
- **Chrono par joueur** (10 à 45 s) et **chrono de débat** (30 s à 3 min).
- Option « revoir mon mot » discrète en cours de manche.

**Vote**
- Deux modes : **rapide** (à main levée) ou **secret** (chacun vote à son tour, téléphone en main).
- Gestion des égalités au choix : nouveau vote, tirage au sort, ou personne d'éliminé.
- Révélation du rôle éliminé activable/désactivable (mode suspense).
- Écran de dernière chance pour Mr White, avec réponse tolérante aux accents et à la casse.

**Score & suivi**
- Points par camp entièrement paramétrables, bonus « mot deviné » pour Mr White,
  objectif de points pour clore la partie.
- Côté imposteurs, seuls les **survivants** marquent : se faire démasquer coûte cher.
- Classement en direct et **statistiques persistantes** (parties, manches, victoires
  par camp, taux de réussite par joueur).

**Confort**
- Mise en page adaptative de l'iPhone SE au Pro Max : aucun défilement parasite,
  listes longues qui défilent sur place et barres d'action toujours atteignables.
- Sons, vibrations, écran maintenu allumé.
- Deux ambiances : **papier** (par défaut) et **encre de nuit**.
- **PWA installable et 100 % hors ligne**, sauvegarde locale de tous les réglages.

## 🎨 Direction artistique

Une esthétique de **dossier d'enquête** : papier journal grainé, encre noire,
aplats gris, titres en romain classique et libellés en machine à écrire. Une seule
couleur — le rouge tampon — réservée à ce qui compte : l'undercover démasqué et les
actions destructrices. Les avatars sont désaturés pour ressembler à des gravures
de presse.

## 📁 Structure

```
index.html               écrans de l'application
assets/styles.css        direction artistique papier/encre, composants mobiles
assets/words.js          banque de 173 paires + catégories
assets/store.js          réglages, joueurs, mots perso, stats (localStorage)
assets/game.js           moteur de jeu (rôles, tours, votes, scores)
assets/app.js            interface et enchaînement des écrans
manifest.webmanifest     installation PWA
sw.js                    cache hors ligne
icons/                   icônes de l'application
```

Aucune dépendance, aucun build : du HTML, du CSS et du JavaScript.
