#!/usr/bin/env python3
"""Validation de finales.json contre la tablebase Lichess.

La transcription des diagrammes photographiés est la principale source d'erreur :
un pion décalé d'une case change le résultat théorique. Ce script interroge la
tablebase Lichess (https://tablebase.lichess.ovh) pour chaque FEN et vérifie que
le résultat avec jeu parfait correspond bien à l'objectif annoncé dans le JSON.

Trois couches de contrôle, de la moins à la plus coûteuse :
  1. légalité      — la FEN se parse, la position est jouable (python-chess)
  2. cohérence     — trait, camp et objectif s'accordent entre eux
  3. théorie       — la tablebase confirme gain / nulle (positions <= 7 pièces)

Usage :
    python3 valider_finales.py                      # valide ./finales.json
    python3 valider_finales.py --json autre.json
    python3 valider_finales.py --hors-ligne         # couches 1-2 seulement
    python3 valider_finales.py --rapport rapport.md

Code de sortie : 0 si tout est OK (avertissements tolérés), 1 sinon — y compris
si la tablebase est injoignable, pour qu'un JSON non vérifié ne passe jamais
pour validé.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import chess
except ImportError:
    sys.exit("python-chess manquant : pip install --only-binary :all: chess")

try:
    import requests
except ImportError:
    sys.exit("requests manquant : pip install requests")

API = "https://tablebase.lichess.ovh/standard"
UA = "finales-echecs-validator/1.0 (validation hors ligne d'un jeu d'exercices)"
MAX_PIECES = 7  # au-delà, la tablebase Lichess ne répond pas
DELAI = 1.1     # secondes entre deux requêtes non mises en cache (politesse)

CAMPS = {"blancs": chess.WHITE, "noirs": chess.BLACK}
OBJECTIFS = {"gagner", "annuler"}

# Conditions de fin acceptées (l'appli s'en sert pour savoir quand l'exercice
# s'arrête). "theorique" = on atteint une position gagnante/nulle connue.
CONDITIONS_FIN = {
    "mat",
    "promotion",
    "gain_materiel",
    "position_theorique",
    "nulle_technique",
    "pat",
    "repetition",
}

OK, ATTENTION, ERREUR, NON_VERIFIABLE, INDISPONIBLE = (
    "OK", "ATTENTION", "ERREUR", "NON_VERIFIABLE", "INDISPONIBLE"
)
GRAVITE = {OK: 0, ATTENTION: 1, NON_VERIFIABLE: 2, INDISPONIBLE: 3, ERREUR: 4}

# Résultat renvoyé par la tablebase, du point de vue du camp au trait.
INVERSE = {
    "win": "loss",
    "loss": "win",
    "draw": "draw",
    "cursed-win": "blessed-loss",
    "blessed-loss": "cursed-win",
    "unknown": "unknown",
    "maybe-win": "maybe-loss",
    "maybe-loss": "maybe-win",
}


def inverse(categorie: str) -> str:
    return INVERSE.get(categorie, "unknown")


@dataclass
class Constat:
    """Une ligne de rapport : un contrôle, son verdict, son explication."""

    ref: str
    statut: str
    message: str

    def __str__(self) -> str:
        return f"[{self.statut:<14}] {self.ref} — {self.message}"


@dataclass
class Rapport:
    constats: list[Constat] = field(default_factory=list)

    def ajouter(self, ref: str, statut: str, message: str) -> None:
        self.constats.append(Constat(ref, statut, message))

    def pire(self) -> str:
        return max((c.statut for c in self.constats), key=lambda s: GRAVITE[s], default=OK)

    def compte(self, statut: str) -> int:
        return sum(1 for c in self.constats if c.statut == statut)


class Tablebase:
    """Client tablebase avec cache disque : un rerun ne re-télécharge rien."""

    def __init__(self, cache: Path, hors_ligne: bool = False):
        self.chemin = cache
        self.hors_ligne = hors_ligne
        self.cache: dict[str, Any] = {}
        if cache.exists():
            self.cache = json.loads(cache.read_text(encoding="utf-8"))
        self.dernier_appel = 0.0

    def enregistrer(self) -> None:
        self.chemin.write_text(
            json.dumps(self.cache, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def interroger(self, fen: str) -> dict[str, Any]:
        """Renvoie {"ok": True, "data": ...} ou {"ok": False, "raison": ...}."""
        if fen in self.cache:
            return self.cache[fen]
        if self.hors_ligne:
            return {"ok": False, "raison": "mode hors ligne"}

        attente = DELAI - (time.monotonic() - self.dernier_appel)
        if attente > 0:
            time.sleep(attente)

        resultat: dict[str, Any]
        for tentative in range(4):
            try:
                reponse = requests.get(
                    API, params={"fen": fen}, headers={"User-Agent": UA}, timeout=20
                )
            except requests.RequestException as exc:
                resultat = {"ok": False, "raison": f"réseau : {type(exc).__name__}"}
                time.sleep(2**tentative)
                continue

            self.dernier_appel = time.monotonic()
            if reponse.status_code == 404:
                # Position hors des tables (trop de pièces, ou variante inconnue).
                resultat = {"ok": False, "raison": "hors tablebase (404)"}
                break
            if reponse.status_code == 429:
                time.sleep(5 * (tentative + 1))
                resultat = {"ok": False, "raison": "quota (429)"}
                continue
            if reponse.status_code != 200:
                resultat = {"ok": False, "raison": f"HTTP {reponse.status_code}"}
                break
            resultat = {"ok": True, "data": reponse.json()}
            break

        if resultat.get("ok") or "hors tablebase" in resultat.get("raison", ""):
            self.cache[fen] = resultat  # on ne met en cache que les réponses fermes
        return resultat


def controler_legalite(rapport: Rapport, ref: str, fen: str) -> chess.Board | None:
    try:
        board = chess.Board(fen)
    except ValueError as exc:
        rapport.ajouter(ref, ERREUR, f"FEN impossible à lire : {exc}")
        return None

    statut = board.status()
    if statut != chess.STATUS_VALID:
        details = [n for n in dir(chess) if n.startswith("STATUS_")
                   and n != "STATUS_VALID" and statut & getattr(chess, n)]
        rapport.ajouter(ref, ERREUR, f"position illégale : {', '.join(details) or statut}")
        return None

    if board.is_checkmate():
        rapport.ajouter(ref, ERREUR, "position déjà matée : rien à jouer")
        return None
    if board.is_stalemate():
        rapport.ajouter(ref, ERREUR, "position déjà pat : rien à jouer")
        return None
    return board


def controler_coherence(rapport: Rapport, ref: str, pos: dict, board: chess.Board) -> bool:
    ok = True
    camp = pos.get("camp")
    if camp not in CAMPS:
        rapport.ajouter(ref, ERREUR, f"camp inconnu : {camp!r} (attendu blancs/noirs)")
        ok = False
    if pos.get("objectif") not in OBJECTIFS:
        rapport.ajouter(ref, ERREUR,
                        f"objectif inconnu : {pos.get('objectif')!r} (attendu gagner/annuler)")
        ok = False
    if pos.get("conditionFin") not in CONDITIONS_FIN:
        rapport.ajouter(ref, ERREUR,
                        f"conditionFin inconnue : {pos.get('conditionFin')!r} "
                        f"(attendu {'/'.join(sorted(CONDITIONS_FIN))})")
        ok = False
    for champ in ("theme", "note"):
        if not str(pos.get(champ, "")).strip():
            rapport.ajouter(ref, ERREUR, f"champ « {champ} » vide")
            ok = False

    # Le trait est porté par la FEN ; s'il est aussi écrit en clair, il doit
    # concorder — un trait inversé à la saisie change souvent le résultat.
    trait_fen = "blancs" if board.turn == chess.WHITE else "noirs"
    trait_declare = pos.get("trait")
    if trait_declare is not None and trait_declare != trait_fen:
        rapport.ajouter(ref, ERREUR,
                        f"trait déclaré {trait_declare!r} mais la FEN donne {trait_fen!r}")
        ok = False
    return ok


def verdict_theorique(rapport: Rapport, ref: str, pos: dict, board: chess.Board,
                      tb: Tablebase) -> None:
    pieces = chess.popcount(board.occupied)
    if pieces > MAX_PIECES:
        rapport.ajouter(ref, NON_VERIFIABLE,
                        f"{pieces} pièces : hors tablebase (max {MAX_PIECES}) — "
                        "à relire à la main sur le diagramme")
        return

    reponse = tb.interroger(board.fen())
    if not reponse.get("ok"):
        raison = reponse.get("raison", "?")
        statut = NON_VERIFIABLE if "hors tablebase" in raison else INDISPONIBLE
        rapport.ajouter(ref, statut, f"tablebase non consultée ({raison})")
        return

    data = reponse["data"]
    categorie_trait = data.get("category", "unknown")
    camp = CAMPS[pos["camp"]]
    reel = categorie_trait if board.turn == camp else inverse(categorie_trait)
    objectif = pos["objectif"]
    dtz, dtm = data.get("dtz"), data.get("dtm")
    chiffres = f"dtz={dtz}, dtm={dtm}"

    attendu = {"gagner": {"win"}, "annuler": {"draw"}}[objectif]
    tolere = {"gagner": {"cursed-win"}, "annuler": {"blessed-loss"}}[objectif]

    if reel in attendu:
        rapport.ajouter(ref, OK, f"tablebase : {reel} pour les {pos['camp']} ({chiffres})")
    elif reel in tolere:
        rapport.ajouter(ref, ATTENTION,
                        f"tablebase : {reel} — l'objectif « {objectif} » ne tient que "
                        f"grâce à la règle des 50 coups ({chiffres}). "
                        "Position discutable comme exercice.")
        return
    elif reel == "unknown":
        rapport.ajouter(ref, NON_VERIFIABLE, "tablebase : résultat inconnu")
        return
    else:
        rapport.ajouter(ref, ERREUR,
                        f"objectif « {objectif} » mais la tablebase donne « {reel} » "
                        f"pour les {pos['camp']} ({chiffres}) — "
                        "diagramme mal transcrit, ou objectif à corriger")
        return

    controler_nettete(rapport, ref, data, board, camp, reel)


def controler_nettete(rapport: Rapport, ref: str, data: dict, board: chess.Board,
                      camp: bool, reel: str) -> None:
    """Un bon exercice se rate : il faut au moins un coup perdant à côté du bon.

    Si tous les coups mènent au même résultat, la position n'apprend rien —
    et c'est souvent le signe qu'on a transcrit une case à côté.
    """
    coups = data.get("moves") or []
    if not coups or board.turn != camp:
        return  # rien à jouer pour notre camp : on ne juge pas

    resultats = {inverse(c.get("category", "unknown")) for c in coups}
    conserve = {"win", "cursed-win"} if reel in {"win", "cursed-win"} else {"draw", "blessed-loss"}
    qui_ratent = [c for c in coups if inverse(c.get("category", "unknown")) not in conserve]

    if not qui_ratent:
        rapport.ajouter(ref, ATTENTION,
                        f"tous les coups conservent le résultat ({sorted(resultats)}) : "
                        "position sans difficulté, à vérifier sur le diagramme")
    elif len(coups) - len(qui_ratent) == 1:
        seul = coups[0].get("san") or coups[0].get("uci")
        rapport.ajouter(ref, OK, f"un seul coup tient : {seul}")


def valider(chemin_json: Path, tb: Tablebase) -> Rapport:
    rapport = Rapport()
    donnees = json.loads(chemin_json.read_text(encoding="utf-8"))
    finales = donnees.get("finales", donnees if isinstance(donnees, list) else [])

    numeros: dict[int, str] = {}
    for finale in finales:
        numero, titre = finale.get("numero"), finale.get("titre", "")
        ref_finale = f"finale {numero}"
        if numero in numeros:
            rapport.ajouter(ref_finale, ERREUR, f"numéro en double (déjà : {numeros[numero]})")
        numeros[numero] = titre
        if not str(titre).strip():
            rapport.ajouter(ref_finale, ERREUR, "titre vide")

        positions = finale.get("positions") or []
        if not 2 <= len(positions) <= 4:
            rapport.ajouter(ref_finale, ERREUR,
                            f"{len(positions)} position(s) : il en faut entre 2 et 4")

        vues: set[str] = set()
        for i, pos in enumerate(positions, 1):
            ref = f"finale {numero}.{i} ({titre})"
            fen = pos.get("fen", "")
            if fen in vues:
                rapport.ajouter(ref, ERREUR, "FEN identique à une autre position de la finale")
                continue
            vues.add(fen)

            board = controler_legalite(rapport, ref, fen)
            if board is None:
                continue
            if not controler_coherence(rapport, ref, pos, board):
                continue
            verdict_theorique(rapport, ref, pos, board, tb)

    manquants = sorted(set(range(1, max(numeros, default=0) + 1)) - set(numeros))
    if manquants:
        rapport.ajouter("ensemble", ATTENTION, f"finales absentes : {manquants}")
    return rapport


def ecrire_rapport(rapport: Rapport, chemin: Path) -> None:
    lignes = ["# Rapport de validation", ""]
    for statut in (ERREUR, INDISPONIBLE, NON_VERIFIABLE, ATTENTION, OK):
        lot = [c for c in rapport.constats if c.statut == statut]
        if not lot:
            continue
        lignes += [f"## {statut} ({len(lot)})", ""]
        lignes += [f"- **{c.ref}** — {c.message}" for c in lot] + [""]
    chemin.write_text("\n".join(lignes), encoding="utf-8")


def main() -> int:
    ici = Path(__file__).parent
    parseur = argparse.ArgumentParser(description=__doc__,
                                      formatter_class=argparse.RawDescriptionHelpFormatter)
    parseur.add_argument("--json", type=Path, default=ici / "finales.json")
    parseur.add_argument("--cache", type=Path, default=ici / ".cache-tablebase.json")
    parseur.add_argument("--hors-ligne", action="store_true",
                         help="sauter la tablebase (légalité et cohérence seulement)")
    parseur.add_argument("--rapport", type=Path, help="écrire aussi un rapport Markdown")
    args = parseur.parse_args()

    if not args.json.exists():
        print(f"Fichier introuvable : {args.json}", file=sys.stderr)
        return 1

    tb = Tablebase(args.cache, hors_ligne=args.hors_ligne)
    try:
        rapport = valider(args.json, tb)
    finally:
        tb.enregistrer()

    for constat in rapport.constats:
        print(constat)

    if args.rapport:
        ecrire_rapport(rapport, args.rapport)

    print("\n" + "-" * 60)
    print(" | ".join(f"{s}: {rapport.compte(s)}"
                     for s in (OK, ATTENTION, NON_VERIFIABLE, INDISPONIBLE, ERREUR)))

    pire = rapport.pire()
    if pire == ERREUR:
        print("ÉCHEC : au moins une position contredit son objectif.")
        return 1
    if pire == INDISPONIBLE:
        print("ÉCHEC : la tablebase n'a pas répondu — le JSON n'est PAS validé.")
        return 1
    if pire == NON_VERIFIABLE:
        print("INCOMPLET : des positions sont hors tablebase, à relire sur le diagramme.")
        return 1
    print("Validé.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
