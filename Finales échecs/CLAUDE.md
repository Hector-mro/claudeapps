# Finales — de la Villa, « Les 100 finales qu'il faut connaître »

## Objectif

Travailler les finales du livre **dans une étude Lichess**, en mode exercice
(gamebook), avec un tirage aléatoire des chapitres par l'extension LichessTools.
Ce dossier ne contient plus d'application : il produit les PGN à importer.

## Ce qu'il y a ici

| Fichier | Rôle |
| --- | --- |
| `100 finales/` | les pages du livre photographiées (finales 1 à 20) |
| `inventaire-photos.md` | correspondance photo → page, bornes des chapitres, pages manquantes |
| `construire_pgn.py` | **la transcription** de toutes les lignes du livre, et la construction des PGN |
| `pgn/finales-01-20.pgn` | le PGN à importer : un chapitre par diagramme de départ |
| `pgn/positions-sans-coups.pgn` | diagrammes que le livre donne sans aucun coup (1.21-1.23, 4.2) |
| `finales.json` | les positions de départ des finales 1 à 20, avec camp, objectif et note personnelle |
| `valider_finales.py` | vérifie `finales.json` contre les tablebases Syzygy (API Lichess) |

`construire_pgn.py` est la source : pour corriger une ligne, on l'édite là puis on
relance `python construire_pgn.py`, qui régénère les deux PGN. Chaque coup, variantes
comprises, est rejoué par python-chess ; un coup illégal arrête la construction.

## Règles de transcription

- **Ne jamais recopier ni reformuler le texte du livre.** Seulement les coups, les
  signes du livre (!, ?, !!, ??, !?, ?!, et =, ±, +-, -+ en NAG `$10`, `$16`, `$18`,
  `$19`) et les renvois aux pages et aux photos. L'utilisateur ouvre le livre pour
  les explications.
- **Toutes les lignes**, pas seulement la principale : les variantes donnent des
  réponses à davantage de coups dans l'étude.
- **Un chapitre = un diagramme de départ.** Les diagrammes qui illustrent seulement
  une position atteinte en cours de ligne ne sont pas des chapitres : un commentaire
  `{Diag. x.y}` les repère au coup où ils apparaissent. Un même diagramme donne deux
  chapitres si le livre l'analyse avec les deux traits (1.4).
- **Lien aux photos** : en-têtes `Pages`, `Photos`, `Diagramme`, `Finale`, plus un
  premier commentaire court `{p.29-30 · 12.12.47 (3) · 12.12.48}`, au cas où Lichess
  ignorerait les en-têtes non standard.
- `Orientation` = le camp dont le livre enseigne les coups (celui que l'on joue dans
  l'exercice), pas forcément le camp au trait.
- Les passages qui décrivent une autre position sans diagramme, ou citent un coup
  sans la suite, ne sont pas transcrits.

## Vérification

En plus de la légalité, les signes du livre ont été confrontés à la tablebase : un
`??` doit changer le résultat, un `!` ne doit pas le lâcher, les évaluations et les
résultats doivent concorder. Le cache disque `.cache_tablebase/` (ignoré par git) est
partagé avec `valider_finales.py`. Le diagramme 1.15 (8 pièces) échappe aux
tablebases.

## Suite

Les photos couvrent les finales 1 à 20 (chapitres 1, 3 et 4). Pour aller plus loin,
photographier les pages suivantes et les ajouter à `inventaire-photos.md`, puis
transcrire dans `construire_pgn.py` selon les mêmes règles.
