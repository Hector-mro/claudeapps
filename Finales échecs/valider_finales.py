# -*- coding: utf-8 -*-
"""Validation de finales.json contre les tablebases Syzygy (API Lichess).

Garde-fou contre les erreurs de transcription des diagrammes photographies.

Principes :
  - le verdict de la tablebase est rendu DANS LE REPERE DE camp_joue avant
    d'etre compare a l'objectif (le camp joue n'est pas toujours celui au trait) ;
  - le champ `trait` est redondant avec la FEN et doit concorder (l'inversion de
    trait est l'erreur de saisie qui retourne le plus souvent le resultat) ;
  - "cursed-win" / "blessed-loss" = resultat suspendu a la regle des 50 coups :
    avertissement, jamais une validation ;
  - si TOUS les coups legaux conservent le resultat, la position n'apprend rien :
    souvent le signe d'un diagramme mal lu -> signale ;
  - code de sortie non nul des qu'une position n'est pas positivement verifiee,
    panne ou blocage de la tablebase compris.

usage: python valider_finales.py [finales.json] [--no-net]
"""
from __future__ import print_function

import hashlib
import io
import json
import os
import sys
import time

import chess
import requests

ICI = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ICI, ".cache_tablebase")
API = "https://tablebase.lichess.ovh/standard"
DELAI = 0.4          # secondes entre deux appels reseau (API publique)
TIMEOUT = 20

# categories renvoyees par l'API, du point de vue du camp au trait
INVERSE = {
    "win": "loss", "loss": "win",
    "cursed-win": "blessed-loss", "blessed-loss": "cursed-win",
    "maybe-win": "maybe-loss", "maybe-loss": "maybe-win",
    "syzygy-win": "syzygy-loss", "syzygy-loss": "syzygy-win",
    "draw": "draw", "unknown": "unknown",
}
GAGNANT = ("win", "syzygy-win")
NULLE = ("draw",)
SOUS_REGLE_50 = ("cursed-win", "blessed-loss")

_derniere_requete = [0.0]


class Blocage(Exception):
    pass


def interroger(fen, autoriser_reseau=True):
    """Verdict tablebase pour `fen`, avec cache disque."""
    cle = hashlib.sha1(fen.encode("utf-8")).hexdigest()
    chemin = os.path.join(CACHE, cle + ".json")
    if os.path.exists(chemin):
        with io.open(chemin, encoding="utf-8") as f:
            return json.load(f), "cache"
    if not autoriser_reseau:
        raise Blocage("absente du cache et --no-net demande")

    attente = DELAI - (time.time() - _derniere_requete[0])
    if attente > 0:
        time.sleep(attente)
    try:
        r = requests.get(API, params={"fen": fen}, timeout=TIMEOUT)
    except Exception as e:
        raise Blocage("reseau : %s" % e)
    finally:
        _derniere_requete[0] = time.time()
    if r.status_code != 200:
        raise Blocage("HTTP %s : %s" % (r.status_code, r.text[:160]))
    try:
        data = r.json()
    except ValueError:
        raise Blocage("reponse illisible : %s" % r.text[:160])
    if not os.path.isdir(CACHE):
        os.makedirs(CACHE)
    with io.open(chemin, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False))
    return data, "reseau"


def echiquier_ascii(board):
    lignes = []
    for rang in range(7, -1, -1):
        cases = []
        for colonne in range(8):
            p = board.piece_at(chess.square(colonne, rang))
            cases.append(p.symbol() if p else ".")
        lignes.append("  %d  %s" % (rang + 1, " ".join(cases)))
    lignes.append("")
    lignes.append("     a b c d e f g h")
    return "\n".join(lignes)


def valider_position(finale, pos, autoriser_reseau=True):
    """-> (ok, lignes_de_rapport)"""
    ident = "finale %s / %s" % (finale["numero"], pos["id"])
    out = []
    erreurs = []
    avertissements = []

    fen = pos["fen"]
    try:
        board = chess.Board(fen)
    except Exception as e:
        return False, ["[%s] FEN illegale : %s" % (ident, e)]

    trait_fen = "blancs" if board.turn == chess.WHITE else "noirs"
    camp = pos["camp_joue"]
    objectif = pos["objectif"]

    out.append("")
    out.append("=== %s - %s" % (ident, pos["theme"]))
    out.append("    %s" % fen)
    out.append(echiquier_ascii(board))
    out.append("    trait declare : %-7s | trait de la FEN : %-7s | camp joue : %-7s | objectif : %s"
               % (pos["trait"], trait_fen, camp, objectif))

    # 1. concordance du trait
    if pos["trait"] != trait_fen:
        erreurs.append("trait declare (%s) != trait de la FEN (%s)" % (pos["trait"], trait_fen))

    # 2. legalite de base
    if not board.is_valid():
        erreurs.append("position illegale (chess.Board.is_valid) : %s" % board.status())
    if len(board.piece_map()) > 7:
        erreurs.append("%d pieces : hors de portee des tablebases 7 pieces"
                       % len(board.piece_map()))

    if erreurs:
        for e in erreurs:
            out.append("    ERREUR    %s" % e)
        return False, out

    # 3. verdict tablebase
    try:
        data, origine = interroger(fen, autoriser_reseau)
    except Blocage as e:
        out.append("    ERREUR    tablebase indisponible (%s)" % e)
        return False, out

    cat_trait = data.get("category")
    if cat_trait not in INVERSE:
        out.append("    ERREUR    categorie inconnue renvoyee par la tablebase : %r" % cat_trait)
        return False, out

    # 4. conversion dans le repere de camp_joue AVANT comparaison
    camp_est_au_trait = (camp == trait_fen)
    cat_camp = cat_trait if camp_est_au_trait else INVERSE[cat_trait]

    out.append("    tablebase [%s] : %s au trait -> %s | dtz=%s dtm=%s"
               % (origine, trait_fen, cat_trait, data.get("dtz"), data.get("dtm")))
    out.append("    verdict dans le repere de %s : %s" % (camp, cat_camp))

    if cat_camp in SOUS_REGLE_50:
        avertissements.append("%s : le resultat ne tient que par la regle des 50 coups "
                              "-> pas une validation" % cat_camp)
        ok_resultat = False
    elif objectif == "gagner":
        ok_resultat = cat_camp in GAGNANT
        if not ok_resultat:
            erreurs.append("objectif 'gagner' mais la tablebase donne '%s' pour les %s"
                           % (cat_camp, camp))
    elif objectif == "tenir la nulle":
        ok_resultat = cat_camp in NULLE
        if not ok_resultat:
            erreurs.append("objectif 'tenir la nulle' mais la tablebase donne '%s' pour les %s"
                           % (cat_camp, camp))
    else:
        erreurs.append("objectif inconnu : %r" % objectif)
        ok_resultat = False

    # 5. la position apprend-elle quelque chose ?
    coups = data.get("moves") or []
    if not coups:
        avertissements.append("aucun coup legal (position terminale) : inutilisable comme exercice")
    else:
        conserve = []
        casse = []
        for m in coups:
            c_enfant = m.get("category")
            if c_enfant not in INVERSE:
                continue
            # categorie de l'enfant vue par celui qui vient de jouer
            c_pour_joueur = INVERSE[c_enfant]
            (conserve if c_pour_joueur == cat_trait else casse).append(m.get("san") or m.get("uci"))
        out.append("    coups legaux (%s au trait) : %d - conservent le resultat : %d - le cassent : %d"
                   % (trait_fen, len(coups), len(conserve), len(casse)))
        if casse:
            out.append("    coups qui cassent le resultat : %s" % ", ".join(casse[:8]))
        elif conserve and camp_est_au_trait:
            avertissements.append("tous les coups legaux conservent le resultat : la position "
                                  "n'apprend rien (verifier la lecture du diagramme)")
        elif conserve:
            # le camp joue n'est pas au trait : le test porterait sur les coups de
            # l'app, pas sur ceux de l'utilisateur -> informatif seulement
            out.append("    (test 'n'apprend rien' non applicable : c'est l'adversaire qui joue "
                       "le premier coup)")

    for e in erreurs:
        out.append("    ERREUR    %s" % e)
    for a in avertissements:
        out.append("    ATTENTION %s" % a)

    ok = ok_resultat and not erreurs and not avertissements
    out.append("    -> %s" % ("VALIDE" if ok else "NON VALIDE"))
    return ok, out


def main(argv):
    autoriser_reseau = "--no-net" not in argv
    args = [a for a in argv[1:] if not a.startswith("--")]
    chemin = args[0] if args else os.path.join(ICI, "finales.json")

    with io.open(chemin, encoding="utf-8") as f:
        finales = json.load(f)

    rapport = []
    total = 0
    valides = 0
    ids = set()
    echecs = []

    for finale in finales:
        for pos in finale["positions"]:
            total += 1
            if pos["id"] in ids:
                rapport.append("ERREUR : id duplique %r" % pos["id"])
                echecs.append(pos["id"])
                continue
            ids.add(pos["id"])
            ok, lignes = valider_position(finale, pos, autoriser_reseau)
            rapport.extend(lignes)
            if ok:
                valides += 1
            else:
                echecs.append("%s/%s" % (finale["numero"], pos["id"]))

    rapport.append("")
    rapport.append("=" * 72)
    rapport.append("%d position(s) sur %d positivement verifiee(s)." % (valides, total))
    if echecs:
        rapport.append("Non validees : %s" % ", ".join(echecs))

    sortie = "\n".join(rapport)
    if hasattr(sys.stdout, "buffer"):
        sys.stdout.buffer.write(sortie.encode("utf-8") + b"\n")
    else:
        print(sortie)
    return 0 if valides == total else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
