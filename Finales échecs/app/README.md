# Entraîneur de finales

Application web sans build ni dépendance : du HTML, du CSS et du JavaScript
servis tels quels, comme les autres applications du dépôt.

## Lancer

L'application lit `../finales.json` et interroge les tablebases : elle doit
être **servie en HTTP** (un `file://` bloque la lecture du JSON) et avoir accès
au réseau.

```sh
cd "Finales échecs"
python -m http.server 8731
```

puis <http://127.0.0.1:8731/app/>.

## Ce que fait l'application

- **Sélection** par plage de finales (1 à 20) et tirage aléatoire dans la
  sélection.
- **Les deux camps** : certains exercices se jouent du côté fort (gagner),
  d'autres du côté faible (tenir la nulle). Le camp joué n'est pas toujours
  celui au trait — l'app joue alors le premier coup.
- **Aucune correction pendant l'exercice.** L'écran de jeu ne dit rien. Si le
  gain est lâché, la défense parfaite fait la nulle et on la subit.
- **L'objectif n'est pas annoncé.** Ni gagner ni tenir, ni la condition de fin,
  ni le thème : reconnaître ce que vaut la position fait partie de l'exercice.
  L'écran de jeu ne donne que le numéro de finale, son titre et le camp joué.
  Le débriefing révèle tout.
- **Bouton « recommencer »** pour reprendre la position à zéro sans voir la
  solution.
- **Débriefing à la fin** : frise de l'évaluation théorique demi-coup par
  demi-coup dans le repère du camp joué, coup exact où le résultat a basculé,
  coups qui tenaient à cet endroit, et suite correcte.
- **Bouton « j'abandonne · montrer la solution »** pour couper court.
- **« Continuer jusqu'au mat »** pour les finales qui s'arrêtent avant la fin
  (promotion obtenue, position acquise, N coups tenus). La prolongation ne
  réécrit pas le verdict de l'exercice : on ne peut pas perdre après coup une
  réussite déjà acquise.

## L'adversaire

Toutes ses décisions sortent des tablebases Syzygy 7 pièces, via l'API publique
de Lichess. Il ne joue pas mécaniquement le coup optimal :

- en position nulle (exercices « tenir la nulle »), il choisit **parmi les coups
  qui préservent le résultat celui qui laisse le moins de réponses correctes** —
  le coup théoriquement optimal est souvent le plus facile à parer ;
- en position perdue, il **maximise la résistance**, puis départage de la même
  façon ;
- en position gagnée, il **convertit** le plus vite possible. Y chercher un
  piège n'a pas de sens (l'adversaire n'a plus une seule réponse correcte à
  éviter) et fait tourner en rond jusqu'à la triple répétition.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `assets/rules.js` | position, coups légaux, FEN, notation. Pas de roque (aucune position n'en porte les droits) ; prise en passant gérée. |
| `assets/tablebase.js` | client de l'API Lichess, cache mémoire + `localStorage`, requêtes sérialisées et espacées, reprise sur 429. |
| `assets/defense.js` | choix du coup de l'app et variante principale. |
| `assets/game.js` | boucle de jeu, conditions de fin, frise d'évaluation, débriefing. |
| `assets/board.js` | échiquier, sélection au clic, promotion. |
| `assets/app.js` | écrans, sélection, tirage, rendu du débriefing. |

## Vérifications

Deux scripts, à la racine de `Finales échecs/` :

```sh
node verifier-regles.js 14   # générateur de coups contre l'oracle tablebase
node verifier-app.js         # boucle de jeu sur les 41 positions
```

- `verifier-regles.js` marche au hasard dans l'arbre depuis chaque position de
  départ et compare, à chaque pas, l'ensemble des coups légaux produits
  localement à celui que renvoie la tablebase. Un oracle indépendant vaut mieux
  qu'un perft ici : il porte exactement sur les positions que l'app utilise,
  sous-promotions comprises.
- `verifier-app.js` vérifie trois propriétés : jouer toujours un coup
  objectivement correct conclut sur « objectif atteint » sans basculement ; une
  faute délibérée conclut sur « objectif manqué » avec le basculement désigné
  exactement à ce demi-coup-là ; et la prolongation jusqu'au mat se termine sans
  toucher au verdict déjà rendu.

Le cache disque (`.cache_tablebase/`, ignoré par git) est partagé avec
`valider_finales.py`, ce qui rend les relances rapides.

## Réseau

L'application a besoin du réseau à l'exécution : c'est le choix retenu dans
`../CLAUDE.md` pour le prototype. Le cache `localStorage` rend une position
déjà travaillée instantanée et la rejoue hors ligne tant qu'on reste dans les
variantes déjà vues. Pour un hors-ligne complet il faudrait pré-calculer le
sous-graphe atteignable et le figer dans le JSON — piste laissée ouverte.
