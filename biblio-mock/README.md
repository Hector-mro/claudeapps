# Bibliothèque métier mock

Bac à sable pour explorer un agent de connaissance sur une bibliothèque documentaire technique
(PDF schématiques, souvent scannés, et liste d'équipements), en remplacement d'une bibliothèque SharePoint réelle.

Source : schémas électriques publics Arduino (dépôt `arduino/docs-content`, licence CC BY-SA), 16 fichiers, **93 pages**.

## Contenu

| Élément | Rôle |
|---|---|
| `Bibliotheque/` | Arborescence façon SharePoint (sites, ateliers, archives, doc constructeur) |
| `equipements.xlsx` / `.csv` | Liste d'équipements, 23 lignes × 13 colonnes, saisie partielle et hétérogène |
| `_verite_terrain.csv` | Ce que contient réellement chaque fichier : **à ne pas donner à l'agent**, sert à l'évaluer |
| `_outils/` | Scripts de génération (`build.py` : scans simulés, `equip.py` : liste) |

## Difficultés introduites volontairement

- **10 fichiers sur 16 sont des « scans »** : image seule sans couche texte, gris, bruit, flou, rotation de ±1,4°, ombre de bord, et parfois une page à l'envers. Il faut passer par l'OCR ou la vision.
- **Noms de fichiers non informatifs** : `scan_20190412_0031.pdf`, `DOC0457.pdf`, `IMG_20200917_0004.pdf`.
- **Un scan regroupe plusieurs documents** : `scan_20190412_0032.pdf` = Motor Shield + 4 Relays Shield + Ethernet Shield.
- **Références incohérentes dans la liste** : tantôt la référence fabricant (`A000067`), tantôt un nom (`MEGA 2560`, `Opta`, `Machine Control`), tantôt rien, et l'information se trouve parfois en commentaire (« Uno ? », « Nano Every »).
- **Colonne « Doc. associée » presque vide**, avec parfois un nom de fichier sans chemin ni extension.
- **Équipements sans aucun document** et **documents sans équipement**.
- Casse variable (`Arduino` / `ARDUINO`), dates partielles (`2019-04`), hiérarchie parent/enfant incomplète.

## Exemples de questions pour l'agent

- Quel document décrit l'équipement EQ-00014, et quel microcontrôleur porte-t-il ?
- Sur l'automate de l'armoire ARM-L4-02, quel composant fait la régulation 24 V → 3,3 V ?
- Quels équipements de la ligne 3 ont un schéma dans la bibliothèque ?
- Que contient `scan_20190412_0032.pdf` ?
- Compléter la colonne « Doc. associée » de la liste.
