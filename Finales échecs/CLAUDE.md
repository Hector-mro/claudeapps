# Entraîneur de finales — de la Villa, « Les 100 finales qu'il faut connaître »

## Objectif

Une application web locale pour travailler les finales du livre sous forme d'exercices
jouables : position de départ, **défense parfaite en face**, sélection par plage de
finales (ex. 1 à 20), tirage aléatoire, plusieurs positions de départ par finale.

Le livre reste la source du contenu pédagogique. L'app ne recopie pas le texte de
l'auteur : seulement les positions (qui sont des faits) et des notes reformulées.

## Source du contenu

Les pages du livre sont photographiées dans le dossier `100 finales/`.

Le sommaire ne liste que les chapitres, mais les bornes suffisent à déduire les numéros
de finale : ch.1 « Les finales élémentaires » = finales 1 à 9, ch.2 est un test (aucune
finale), ch.3 « Cavalier contre pion » = 10 à 15, ch.4 « Dame contre pion » = 16 à 20,
ch.5 « Tour contre pion » démarre à 21. **Les finales 1 à 20 correspondent donc
exactement aux chapitres 1, 3 et 4.**

## Décision de support

Application web autonome, **pas** une étude Lichess. Raison : la défense doit être
adaptative des deux côtés, les conditions de fin varient par exercice, le débriefing
est différé, et il faut du tirage aléatoire et un suivi. Une étude Lichess (mode
gamebook) a une défense scriptée qui refuse tout coup gagnant non prévu — rédhibitoire.
Une étude pourra être générée plus tard comme export secondaire, pour réviser sur mobile.

## Le moteur : tablebases, pas Stockfish

Toutes les finales visées sont à ≤ 7 pièces. On utilise les tablebases Syzygy 7 pièces
via l'API publique de Lichess : `https://tablebase.lichess.ovh/standard?fen=...`
(voir `https://github.com/lichess-org/lila-tablebase`). Elle renvoie, pour chaque coup
légal, le résultat théorique (`category`) et les distances (`dtz`, `dtm`).

Ce que ça donne, et qu'un moteur ne donne pas :

- défense réellement parfaite (maximisation de la résistance) ;
- arbitrage exact : « ce coup transforme le gain en nulle » — impossible avec une
  évaluation en centipions dans une finale où tout vaut 0.00 ;
- acceptation de **tous** les chemins gagnants, pas seulement celui du livre.

Deux implémentations possibles, à trancher :

- **appel direct à l'API** — simple, nécessite le réseau à l'exécution ;
- **arbre pré-calculé** — on interroge la tablebase à la construction et on fige dans
  le JSON le sous-graphe atteignable depuis chaque position de départ. Zéro dépendance
  réseau ensuite. Viable ici (quelques milliers de nœuds au plus).

Recommandation : API en direct pour le prototype, pré-calcul si on veut le hors-ligne.

## Spec fonctionnelle

1. **Sélection** par plage de finales, plus tirage aléatoire dans la sélection.
2. **Les deux camps** — certains exercices se jouent du côté fort (gagner), d'autres du
   côté faible (tenir la nulle).
3. **Condition de fin variable selon la finale** — mat, promotion, ou « position acquise »
   (ex. Lucena : on s'arrête quand la Tour est libérée), avec un bouton
   « continuer jusqu'au mat » pour celles qui s'arrêtent avant la fin.
4. **Pas de correction coup par coup.** Point le plus structurant. L'exercice se joue
   jusqu'au bout ; si le gain est lâché, la défense parfaite fait la nulle et l'utilisateur
   la subit — c'est le signal pédagogique. Le débriefing arrive **à la fin** :
   frise de l'évaluation théorique coup par coup, coup exact où le résultat a basculé,
   variante gagnante à partir de ce point. Plus un bouton
   « j'abandonne / montrer la solution » pour couper court.
5. **Cible** — ordinateur en priorité, mobile en bonus.
6. **2 à 4 positions de départ par finale**, selon les cas de figure : la position type
   du livre, plus des variantes de placement (aile opposée, pion-tour vs pion central)
   qui empêchent d'apprendre la séquence par cœur.

### Défense de l'app : tendre des pièges, pas jouer proprement

Quand l'app a l'avantage (exercices « tenir la nulle »), le coup théoriquement optimal
est souvent le plus facile à parer. Choisir plutôt, **parmi les coups qui préservent le
résultat**, celui qui laisse à l'utilisateur le moins de réponses correctes.
Symétriquement en défense d'une position perdue : maximiser la résistance (DTZ/DTM).

## Modèle de données

Un fichier `finales.json`, source unique alimentant l'app (et plus tard un PGN d'étude).

```jsonc
{
  "numero": 2,
  "titre": "Le pion en sixième rangée",
  "chapitre": 1,
  "positions": [
    {
      "id": "2a",
      "fen": "5k2/8/5PK1/8/8/8/8/8 w - - 0 1",
      "camp_joue": "blancs",           // le camp que joue l'utilisateur
      "objectif": "gagner",            // "gagner" | "tenir la nulle"
      "fin": "promotion",              // "mat" | "promotion" | "position" | "coups:N"
      "fin_detail": null,              // ex. FEN ou prédicat pour "position"
      "theme": "opposition",
      "note": "…reformulation personnelle, pas le texte du livre…"
    }
  ]
}
```

**Étape de validation obligatoire** : un script qui interroge la tablebase pour chaque
FEN et vérifie que le résultat théorique correspond à l'objectif annoncé. C'est le
garde-fou contre les erreurs de transcription des diagrammes photographiés.

## Plan de travail

1. Lire les photos et construire `finales.json` pour les finales 1 à 20.
2. Écrire le script de validation tablebase et le passer sur tout le fichier.
3. Construire l'app : échiquier, boucle de jeu, défense tablebase, conditions de fin,
   sélection par plage, tirage aléatoire, débriefing de fin d'exercice.
4. Ajouter le suivi : historique des tentatives, rappel prioritaire des finales ratées.
5. Optionnel : export PGN vers une étude Lichess privée pour la révision mobile.

## Notes

- Les positions (FEN) sont des faits, pas une œuvre protégée. Les commentaires du livre
  le sont : ne pas les recopier, écrire ses propres notes.
- Au-delà du chapitre 11, certaines finales dépasseront 7 pièces ; il faudra alors
  Stockfish ou des lignes préparées. Non bloquant pour les finales 1 à 20.
