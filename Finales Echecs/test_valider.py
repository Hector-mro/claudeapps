#!/usr/bin/env python3
"""Auto-test de valider_finales.py : la logique de verdict, sans réseau.

Les réponses de la tablebase sont simulées : ce qu'on teste ici, c'est la
traduction « catégorie tablebase + camp joué » -> verdict, pas la théorie des
finales elle-même. Lancer : python3 test_valider.py
"""

import json
import tempfile
from pathlib import Path

import valider_finales as v

# FENs de travail, choisies pour être légales et faciles à lire.
RK_BLANCS = "8/8/8/4k3/8/8/8/R3K3 w - - 0 1"       # T+R contre R, trait aux blancs
RK_NOIRS = "8/8/8/4K3/8/8/8/r3k3 b - - 0 1"         # idem miroir, trait aux noirs
HUIT_PIECES = "8/p4p2/8/5k2/5P2/P7/5K2/4r1R1 w - - 0 1"
ROIS_COLLES = "8/8/8/8/8/8/8/Kk6 w - - 0 1"


class TablebaseSimulee(v.Tablebase):
    """Renvoie des catégories fixées d'avance ; compte les appels réseau."""

    def __init__(self, reponses):
        self.reponses = reponses
        self.appels = []
        self.cache = {}
        self.hors_ligne = False
        self.dernier_appel = 0.0
        self.chemin = Path(tempfile.mkdtemp()) / "cache.json"

    def interroger(self, fen):
        self.appels.append(fen)
        return self.reponses.get(fen.split(" ")[0], {"ok": False, "raison": "non simulé"})


def reponse(categorie, coups=None):
    return {"ok": True, "data": {"category": categorie, "dtz": 1, "dtm": 17,
                                 "moves": coups or []}}


def position(**kwargs):
    base = {"fen": RK_BLANCS, "camp": "blancs", "objectif": "gagner",
            "conditionFin": "mat", "theme": "opposition", "note": "note de test"}
    base.update(kwargs)
    return base


def lancer(finales, reponses):
    fichier = Path(tempfile.mkdtemp()) / "finales.json"
    fichier.write_text(json.dumps({"finales": finales}), encoding="utf-8")
    tb = TablebaseSimulee(reponses)
    return v.valider(fichier, tb), tb


def finale(positions, numero=1):
    return [{"numero": numero, "titre": "Finale de test", "positions": positions}]


def statuts(rapport):
    return [(c.statut, c.message) for c in rapport.constats]


def attendre(rapport, statut, extrait):
    trouve = [m for s, m in statuts(rapport) if s == statut and extrait in m]
    assert trouve, f"attendu {statut} contenant {extrait!r}, obtenu : {statuts(rapport)}"


# 1. Gain confirmé, le camp joué est au trait.
r, _ = lancer(finale([position(), position(fen=RK_NOIRS, camp="noirs")]),
              {RK_BLANCS.split()[0]: reponse("win"), RK_NOIRS.split()[0]: reponse("win")})
attendre(r, v.OK, "win pour les blancs")
assert r.pire() == v.OK, statuts(r)

# 2. Inversion : le camp joué n'est pas au trait, la tablebase dit « loss »
#    pour le trait, donc « win » pour nous.
r, _ = lancer(finale([position(fen=RK_NOIRS, camp="blancs"), position()]),
              {RK_NOIRS.split()[0]: reponse("loss"), RK_BLANCS.split()[0]: reponse("win")})
attendre(r, v.OK, "win pour les blancs")

# 3. Contradiction franche : on annonce la nulle, la tablebase donne perdu.
r, _ = lancer(finale([position(objectif="annuler", conditionFin="nulle_technique"),
                      position(fen=RK_NOIRS, camp="noirs")]),
              {RK_BLANCS.split()[0]: reponse("loss"),
               RK_NOIRS.split()[0]: reponse("win")})
attendre(r, v.ERREUR, "la tablebase donne « loss »")
assert r.pire() == v.ERREUR

# 4. Gain seulement grâce aux 50 coups -> avertissement, pas validation franche.
r, _ = lancer(finale([position(), position(fen=RK_NOIRS, camp="noirs")]),
              {RK_BLANCS.split()[0]: reponse("cursed-win"),
               RK_NOIRS.split()[0]: reponse("win")})
attendre(r, v.ATTENTION, "règle des 50 coups")

# 5. Position illégale : rejetée avant tout appel réseau.
r, tb = lancer(finale([position(fen=ROIS_COLLES), position()]),
               {RK_BLANCS.split()[0]: reponse("win")})
attendre(r, v.ERREUR, "position illégale")
assert ROIS_COLLES not in tb.appels

# 6. Trait déclaré incohérent avec la FEN (erreur de saisie classique).
r, _ = lancer(finale([position(trait="noirs"), position(fen=RK_NOIRS, camp="noirs")]),
              {RK_BLANCS.split()[0]: reponse("win"), RK_NOIRS.split()[0]: reponse("win")})
attendre(r, v.ERREUR, "trait déclaré")

# 7. Plus de 7 pièces : non vérifiable, et aucun appel inutile.
r, tb = lancer(finale([position(fen=HUIT_PIECES), position()]),
               {RK_BLANCS.split()[0]: reponse("win")})
attendre(r, v.NON_VERIFIABLE, "hors tablebase")
assert HUIT_PIECES not in tb.appels

# 8. Tablebase injoignable -> INDISPONIBLE (et donc échec global).
r, _ = lancer(finale([position(), position(fen=RK_NOIRS, camp="noirs")]), {})
attendre(r, v.INDISPONIBLE, "tablebase non consultée")
assert r.pire() == v.INDISPONIBLE

# 9. Champs obligatoires et énumérations.
r, _ = lancer(finale([position(note="  "),
                      position(fen=RK_NOIRS, camp="noirs", conditionFin="bidule")]), {})
attendre(r, v.ERREUR, "champ « note » vide")
attendre(r, v.ERREUR, "conditionFin inconnue")

# 10. Structure : nombre de positions, doublons, titre.
r, _ = lancer(finale([position()]), {RK_BLANCS.split()[0]: reponse("win")})
attendre(r, v.ERREUR, "il en faut entre 2 et 4")
r, _ = lancer(finale([position(), position()]), {RK_BLANCS.split()[0]: reponse("win")})
attendre(r, v.ERREUR, "FEN identique")

# 11. Netteté : si tous les coups gagnent, la position n'est pas un exercice.
tous_gagnants = [{"san": "Ka2", "category": "loss"}, {"san": "Kb1", "category": "loss"}]
r, _ = lancer(finale([position(), position(fen=RK_NOIRS, camp="noirs")]),
              {RK_BLANCS.split()[0]: reponse("win", tous_gagnants),
               RK_NOIRS.split()[0]: reponse("win")})
attendre(r, v.ATTENTION, "tous les coups conservent le résultat")

un_seul = [{"san": "Ka2", "category": "loss"}, {"san": "Kb1", "category": "draw"}]
r, _ = lancer(finale([position(), position(fen=RK_NOIRS, camp="noirs")]),
              {RK_BLANCS.split()[0]: reponse("win", un_seul),
               RK_NOIRS.split()[0]: reponse("win")})
attendre(r, v.OK, "un seul coup tient : Ka2")

print("11 scénarios passés.")
