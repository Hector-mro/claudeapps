# Format de `finales.json`

> Schéma **provisoire** : il est déduit de la commande, pas du `CLAUDE.md` du
> projet, qui est absent du dépôt (voir « Ce qui manque » plus bas). À caler dès
> que la spec est là.

```jsonc
{
  "version": 1,
  "source": "…",
  "finales": [
    {
      "numero": 1,                    // numéro de la finale dans le livre
      "titre": "…",                   // titre relevé sur la page
      "positions": [                  // 2 à 4 par finale
        {
          "id": "1a",
          "fen": "…",                 // position complète, trait compris
          "trait": "blancs|noirs",    // redondant avec la FEN : c'est voulu
          "camp": "blancs|noirs",     // le camp que joue l'élève
          "objectif": "gagner|annuler",
          "conditionFin": "mat|promotion|gain_materiel|position_theorique|nulle_technique|pat|repetition",
          "theme": "…",               // opposition, case de transformation, pont, Philidor…
          "note": "…"                 // 1 à 2 phrases, de ma main
        }
      ]
    }
  ]
}
```

Deux choix qui méritent un mot :

- **`trait` est redondant avec la FEN, exprès.** Inverser le trait est l'erreur
  de transcription la plus coûteuse (elle retourne souvent le résultat). En
  l'écrivant deux fois, le validateur peut la détecter au lieu de la propager.
- **`camp` n'est pas forcément le camp au trait.** Un exercice peut commencer
  par un coup de l'adversaire. Le validateur convertit le verdict de la
  tablebase dans le repère de `camp` avant de le comparer à `objectif`.

La première position de chaque finale est le diagramme principal ; les suivantes
sont des variantes de placement (aile opposée, pion-tour au lieu d'un pion
central, trait inversé quand ça change le résultat).

`exemple-format.json` montre le format et le niveau de détail des notes sur deux
positions d'école — **ce ne sont pas des transcriptions du livre**.

## Validation

```bash
pip install --only-binary :all: chess requests
python3 valider_finales.py                 # valide ./finales.json
python3 valider_finales.py --hors-ligne    # légalité + cohérence seulement
python3 valider_finales.py --rapport rapport.md
python3 test_valider.py                    # auto-test du validateur (sans réseau)
```

Trois couches, de la moins à la plus coûteuse :

1. **Légalité** (python-chess, hors ligne) — FEN lisible, position jouable, rois
   non collés, ni mat ni pat d'entrée.
2. **Cohérence** (hors ligne) — `trait` conforme à la FEN, énumérations
   respectées, champs non vides, 2 à 4 positions, pas de FEN en double, pas de
   numéro manquant.
3. **Théorie** (tablebase Lichess) — le résultat avec jeu parfait est traduit
   dans le repère de `camp`, puis comparé à `objectif`. En prime, le validateur
   regarde la liste des coups : si **tous** conservent le résultat, la position
   n'apprend rien et mérite une relecture du diagramme.

Verdicts : `OK`, `ATTENTION` (gain ou nulle qui ne tient que par la règle des 50
coups, position sans difficulté), `NON_VERIFIABLE` (plus de 7 pièces : hors
tablebase), `INDISPONIBLE` (tablebase injoignable), `ERREUR` (contradiction
franche). Le script sort en code 1 dès qu'une position n'est **pas** vérifiée —
tablebase injoignable comprise — pour qu'un JSON non validé ne puisse jamais
passer pour validé.

Les réponses sont mises en cache dans `.cache-tablebase.json` : un rerun ne
re-télécharge rien et le cache est relisible à la main.

## Ce qui manque pour construire `finales.json`

- **Les photos.** Aucun dossier `100 finales` dans le dépôt ni dans la machine
  de la session (`/home/user`, `/mnt/attach`, `/mnt/user-data` vides), et rien
  dans l'historique git.
- **Le `CLAUDE.md`** du projet. Le seul du dépôt est `todo-app/CLAUDE.md`, sans
  rapport.
- **L'accès à `tablebase.lichess.ovh`**, refusé par la politique réseau de
  l'environnement (403 au CONNECT ; `lichess.org` et `syzygy-tables.info` aussi).
  Le validateur tourne, mais sa couche 3 ne peut pas s'exécuter ici.

Tant que la couche 3 n'a pas tourné, aucune finale ne doit être considérée comme
relue : plus de 7 pièces, la tablebase ne répond de toute façon pas, et ces
positions-là resteront à contrôler à l'œil sur le diagramme.
