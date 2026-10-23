# Banc d'essai : identification des documents et rattachement aux équipements

Corpus : 16 PDF, 93 pages (10 fichiers en scans simulés). Machine : 4 cœurs CPU, sans GPU.
Tâche évaluée : retrouver le document de chacun des 23 équipements de `equipements.csv` (vérité : `_verite_equipements.csv`).

## Résultats

| Extraction du texte | CPU s/page | Docs identifiés | Rattachement lexical (L1) | Rattachement + référentiel (L2) |
|---|---|---|---|---|
| Aucune (chemin + nom de fichier) | 0 | – | 12/23 | 7/23 |
| `pdftotext` (couche texte native) | 0,05 | 8/16 | 11/23 | 10/23 |
| Tesseract, page entière 200 dpi | 3,3 | – | 12/23 | 16/23 |
| Tesseract, cartouche seul 300 dpi | 1,3 | 7/16 | 10/23 | 9/23 |
| RapidOCR, page entière 200 dpi | 21,6 | 16/16 | 15/23 | 21/23 |
| RapidOCR, page entière 300 dpi | 30,0 | 16/16 | 14/23 | 21/23 |
| RapidOCR, cartouche seul 200 dpi | 6,9 | 14/16 | 14/23 | 19/23 |
| **Cascade page par page : cartouche 0°+180°, page entière si rien** | **10,1** | **16/16** | 16/23 | **22/23** |

- **L1** : recouvrement de mots entre la ligne équipement et le texte du document.
- **L2** : chaque ligne équipement et chaque document sont ramenés à un produit normalisé via un référentiel
  (référence fabricant ↔ noms commerciaux ↔ puces principales), puis départagés par site/localisation.

## Enseignements

1. **Le référentiel pèse plus que le moteur OCR.** Le lexical plafonne à ~15/23 et se trompe en silence ;
   L2 échoue surtout en « pas de lien », ce qui est récupérable.
2. **Lire le cartouche d'abord.** Il porte le nom, la référence, la révision et la date. Lu seul, il coûte 3 fois moins de CPU
   qu'une page entière et ~5 fois moins de tokens en vision (~450 contre ~2 200).
3. **Raisonner par page, pas par fichier.** Un scan peut contenir plusieurs documents (`scan_20190412_0032`).
4. **Orientation** : lire les deux sens et concaténer ; « garder la meilleure lecture » se trompe.
5. **Tesseract est rapide mais faible sur les schémas.** RapidOCR (ONNX, `pip install` sans droits admin) est nettement meilleur.
6. **Un PDF natif n'a pas toujours de texte** : 4 des PDF Arduino d'origine n'ont aucune couche texte exploitable.
7. **Échec restant : Motor Shield**, sans cartouche, identifiable seulement par « L298 » en tout petit. C'est le cas pour la vision.

## Coûts API estimés pour 1 million de pages (tarifs relevés le 23/10/2026)

| Approche | Haiku 5.5 | Haiku 5.5 en batch | Sonnet 5.5 en batch |
|---|---|---|---|
| Vision page entière (1568 px, ~2 400 tokens) | 318 $ | 159 $ | 3 180 $ |
| Vision cartouche (2 crops, ~1 100 tokens) | 160 $ | 80 $ | 1 600 $ |
| Texte OCR du cartouche → normalisation LLM | 90 $ | 45 $ | 900 $ |
| Cascade OCR locale + référentiel déterministe | 0 $ | 0 $ | 0 $ (≈ 2 800 h CPU) |

1 To ≈ 1 à 10 millions de pages selon la compression des scans : à mesurer sur un dossier échantillon.

## Limites

- Échantillon minuscule ; mots-clés et référentiel écrits en connaissant les documents : les scores sont optimistes.
- L'approche vision a été testée en lisant les images avec un modèle haut de gamme, pas avec Haiku : à vérifier sur 50 pages réelles.
- Les scans simulés sont plus propres qu'un vrai scan de plan A3 imprimé.
