# -*- coding: utf-8 -*-
"""Construit les PGN d'étude Lichess à partir des lignes du livre.

Une entrée = un chapitre d'étude = un diagramme de départ, avec toutes les
lignes que le livre donne depuis cette position (principale et secondaires).
Les diagrammes qui ne font qu'illustrer une position atteinte en cours de
ligne ne sont pas des chapitres : ils sont repérés par un commentaire
{Diag. x.y} au coup où ils apparaissent.

Aucun texte du livre n'est recopié : seulement les coups, les signes
d'évaluation (!, ?, =, +-, ...) et les renvois aux pages et aux photos.

Chaque coup est rejoué par python-chess : un coup illégal (erreur de lecture
des photos) arrête la construction.

usage: python construire_pgn.py
"""
from __future__ import print_function

import io
import json
import os
import sys

import chess
import chess.pgn

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "pgn")
PHOTO = "WhatsApp Image 2026-09-19 at {}.jpeg"

# Signes du livre sans équivalent direct en SAN : codes NAG standard.
#   $10 =    $16 +-/±    $18 +-    $19 -+

CHAPITRES = [
    # --- Chapitre 1 : les finales élémentaires ---------------------------
    dict(finale=1, diag="1.1", pages="27-28", photos=["12.12.47 (2)", "12.13.08"],
         fen="6k1/8/8/8/8/8/P7/7K w - - 0 1", camp="white",
         coups="1. a4! {Diag. 1.2} 1... Kf7 2. a5 Ke6 3. a6 Kd6 4. a7 Kc7 5. a8=Q 1-0"),
    dict(finale=1, diag="1.3", pages="28-29", photos=["12.13.08", "12.12.47 (3)"],
         fen="8/4k3/2K5/8/8/8/1P6/8 w - - 0 1", camp="white",
         coups="1. Kc7! Ke6 2. b4 Kd5 3. b5 1-0"),
    dict(finale=2, diag="1.4", pages="29", photos=["12.12.47 (3)"],
         fen="5k2/8/5PK1/8/8/8/8/8 w - - 0 1", camp="white",
         coups="1. f7! Ke7 2. Kg7! 1-0"),
    dict(finale=2, diag="1.4", pages="29-30", photos=["12.12.47 (3)", "12.12.48"],
         fen="5k2/8/5PK1/8/8/8/8/8 b - - 0 1", camp="black",
         coups="1... Kg8! {Diag. 1.5} 2. f7+ (2. Kg5 Kf7! (2... Kf8) 3. Kf5 Kf8! "
               "4. Kf4 Kf7! 5. Kf5 Kf8 6. Ke6 Ke8! 7. f7+ Kf8 8. Kf6) "
               "2... Kf8! 3. Kf6 1/2-1/2"),
    dict(finale=2, diag="1.6", pages="31", photos=["12.13.08 (1)"],
         fen="k7/8/2P5/K7/8/8/8/8 w - - 0 1", camp="white",
         coups="1. Ka6! (1. Kb6?? Kb8! $10) 1... Kb8 2. Kb6! Kc8 "
               "(2... Ka8 3. Kc7! (3. c7??) 3... Ka7 4. Kd7) 3. c7 Kd7 4. Kb7 1-0"),
    dict(finale=2, diag="1.7", pages="31-32", photos=["12.13.08 (1)", "12.12.48 (1)"],
         fen="8/6k1/4P3/6K1/8/8/8/8 w - - 0 1", camp="white",
         coups="1. Kf5! Kg8 (1... Kf8 2. Kf6) 2. Kg6! Kf8 3. Kf6 Ke8 4. e7 Kd7 5. Kf7 1-0"),
    dict(finale=2, diag="1.8", pages="32", photos=["12.12.48 (1)"],
         fen="8/8/8/8/8/5kp1/7K/8 w - - 0 1", camp="white",
         coups="1. Kh1! Kf2 (1... Kg4 2. Kg2! $10) 1/2-1/2"),
    dict(finale=3, diag="1.9", pages="32-33", photos=["12.12.48 (1)", "12.12.48 (2)"],
         fen="5k2/8/4K3/5P2/8/8/8/8 w - - 0 1", camp="white",
         coups="1. Kf6! (1. f6?? Ke8! $10) 1... Ke8 2. Kg7! Ke7 3. f6+ Ke6 4. f7 1-0"),
    dict(finale=3, diag="1.10", pages="33-34", photos=["12.12.48 (2)", "12.12.49"],
         fen="7k/5K2/8/6P1/8/8/8/8 w - - 0 1", camp="white",
         coups="1. Kg6! (1. g6?) (1. Kf6 Kh7! (1... Kg8 2. Kg6 Kh8 3. Kf7 Kh7 4. g6+ Kh8 "
               "5. g7+ $18) 2. g6+?? (2. Kf7!) 2... Kh8! $10) 1... Kg8 2. Kh6 Kh8 3. g6 Kg8 "
               "4. g7 Kf7 5. Kh7 1-0"),
    dict(finale=3, diag="1.11", pages="34", photos=["12.12.49"],
         fen="5k2/8/8/8/3PK3/8/8/8 w - - 0 1", camp="white",
         coups="1. Kd5! (1. Ke5?? Ke7) 1... Ke7 2. Kc6 Kd8 3. Kd6 Kc8 4. Ke7 Kc7 5. d5 Kc8 "
               "6. d6 Kb7 7. d7 1-0"),
    dict(finale=3, diag="1.12", pages="35", photos=["12.12.49 (1)"],
         fen="8/8/8/1kp5/8/8/8/K7 w - - 0 1", camp="white",
         coups="1. Kb1! Kb4 (1... Kc4 2. Kc2) 2. Kb2! c4 3. Kc2 c3 4. Kc1 Kb3 5. Kb1 c2+ "
               "6. Kc1 Kc3 $10 1/2-1/2"),
    dict(finale=3, diag="1.13", pages="36", photos=["12.12.49 (2)"],
         fen="8/6k1/8/6K1/8/6P1/8/8 w - - 0 1", camp="white",
         coups="1. g4 Kh7 (1... Kf7 2. Kh6) 2. Kf6 Kh8 (2... Kh6 3. g5+ Kh7 4. Kf7) "
               "(2... Kg8 3. Kg6 Kf8 4. Kh7) 3. Kg6 Kg8 4. g5! Kh8 5. Kf7 Kh7 6. g6+ Kh6 "
               "7. g7 1-0"),
    dict(finale=4, diag="1.14", pages="36-37", photos=["12.12.49 (2)", "12.12.50"],
         fen="8/8/8/8/8/6kp/8/6K1 w - - 0 1", camp="white",
         coups="1. Kh1 h2 1/2-1/2"),
    dict(finale=4, diag="1.15", pages="37", photos=["12.12.50"],
         fen="8/7p/7p/7p/7p/6kp/7p/6K1 w - - 0 1", camp="white",
         coups="1. Kh1 Kf3 2. Kxh2 Kg4 3. Kh1 Kg3 4. Kg1 h2+ 5. Kh1 Kg4 6. Kxh2 h3 "
               "7. Kh1 Kg3 8. Kg1 h4 9. Kh1 h5 10. Kg1 h6 11. Kh1 Kf3 12. Kh2 Kg4 "
               "13. Kh1 Kg3 14. Kg1 h2+ 15. Kh1 1/2-1/2"),
    dict(finale=5, diag="1.16", pages="37-38", photos=["12.12.50", "12.12.50 (1)"],
         fen="8/8/8/p7/8/1k6/3K4/8 w - - 0 1", camp="white",
         coups="1. Kc1! Ka2 (1... a4 2. Kb1 a3 3. Ka1 $10) 2. Kc2! a4 (2... Ka3 3. Kb1 $10) "
               "3. Kc1 a3 4. Kc2 Ka1 5. Kc1 1/2-1/2"),
    dict(finale=6, diag="1.17", pages="38-39", photos=["12.12.50 (1)", "12.13.08 (2)"],
         fen="6k1/5R2/6K1/8/8/8/8/6b1 w - - 0 1", camp="white",
         coups="1. Rf1 (1. Rb7?? Kf8) 1... Bh2 (1... Bd4 2. Rd1 Bb6 3. Rb1 Bc7 4. Rc1) "
               "2. Rh1 Bg3 3. Rg1 Bh2 4. Rg2 Bd6 (4... Bf4 5. Kf5+ $18) 5. Rd2 Be7 "
               "6. Rc2 Bf8 7. Rc8 1-0"),
    dict(finale=7, diag="1.18", pages="39", photos=["12.13.08 (2)"],
         fen="7k/R7/7K/8/8/1b6/8/8 w - - 0 1", camp="black",
         coups="1. Ra8+ Bg8 2. Ra7 (2. Kg5 Kg7 3. Ra7+ Kh8 4. Kg6 Bc4 5. Ra3 Bd5 6. Rh3+ Kg8 "
               "7. Re3 Kh8) 2... Bb3 3. Kg6 (3. Rh7+ Kg8 4. Rb7 Bd5) 3... Bc4 "
               "(3... Be6?? 4. Rh7+ Kg8 5. Re7 $18) 4. Rh7+ Kg8 5. Rc7 Bd3+ 6. Kh6 Be4 "
               "$10 1/2-1/2"),
    dict(finale=8, diag="1.19", pages="40-41", photos=["12.13.08 (3)", "12.12.50 (2)"],
         fen="8/8/8/8/8/3k4/r7/3NK3 w - - 0 1", camp="white",
         coups="1. Nf2+ Ke3 2. Nd1+ Kf3 3. Nc3 (3. Kf1 Re2 4. Nc3) 3... Rc2 4. Nd1 "
               "(4. Nd5?? {Diag. 1.20} 4... Rc4 5. Nb6 (5. Nf6 Rd4 6. Nh7 Kf4 7. Nf8 Kf5 $19) "
               "5... Rb4 6. Nc8 (6. Nd5 Re4+ 7. Kf1 Rd4 8. Nc3 Rd3 $19) 6... Rb7! 7. Kd2 "
               "(7. Nd6 Re7+ 8. Kf1 Rd7 $19) 7... Kf4 8. Ke2 Ke5 $19) "
               "4... Re2+ 5. Kf1 Rh2 6. Ke1 Rc2 7. Kf1 $10 1/2-1/2"),
    # --- Chapitre 3 : Cavalier contre pion -------------------------------
    dict(finale=10, diag="3.1", pages="55", photos=["12.12.50 (3)"],
         fen="8/K7/8/8/8/1k6/1N1p4/8 w - - 0 1", camp="white",
         coups="1. Nd1 Kc2 2. Nf2! (2. Ne3+) 2... Kc3 3. Ka6 Kd4 4. Kb5 Ke3 5. Nd1+ Ke2 "
               "6. Nb2! $10 1/2-1/2"),
    dict(finale=10, diag="3.2", pages="56", photos=["12.12.50 (4)"],
         fen="8/8/8/8/5N2/8/2p4K/2k5 w - - 0 1", camp="white",
         coups="1. Ne2+! (1. Nd3+?? Kd2! 2. Nc5!? Kc3! 3. Ne4+ Kd3 4. Nc5+ Kc4 $19) "
               "1... Kd2 (1... Kd1 2. Nc3+! Kd2 3. Na2 $10) 2. Nd4! c1=Q 3. Nb3+ $10 1/2-1/2"),
    dict(finale=11, diag="3.3", pages="57", photos=["12.13.09 (2)"],
         fen="8/8/8/8/4N3/1p6/7K/1k6 b - - 0 1", camp="black",
         coups="1... b2! (1... Kc2?! 2. Nd6! Kc3 (2... b2 3. Nc4 $10) (2... Kd3 3. Nb5 $10) "
               "3. Ne4+ Kd4 4. Nd2 b2 5. Nb1 Kd3 6. Kg2 Kc2 7. Na3+ Kb3 8. Nb1 $10) "
               "2. Nd2+ (2. Nc3+ Kc2 3. Nb5 Kb3 4. Nd4+ Kc3 5. Nb5+ Kb4 $19) 2... Kc1! "
               "3. Nb3+ Kd1 $19 0-1"),
    dict(finale=12, diag="3.4", pages="58", photos=["12.12.51 (1)"],
         fen="8/8/K7/4N3/8/7p/7k/8 w - - 0 1", camp="white",
         coups="1. Ng4+! (1. Nc4 Kg2 (1... Kg1 2. Ne5! Kf1 3. Ng4! $10) (1... Kg3 2. Ne3 $10) "
               "2. Ne3+ $16) (1. Nf3+? Kg2 2. Nh4+ (2. Ne1+ Kg3 $19) 2... Kf2 $19) "
               "1... Kg3 2. Ne3 Kf3 3. Nf1 Kf2 4. Nh2 $10 1/2-1/2"),
    dict(finale=13, diag="3.5", pages="58-59", photos=["12.12.51 (1)", "12.12.51 (2)"],
         fen="K7/8/8/5N2/8/3k3p/8/8 w - - 0 1", camp="white",
         coups="1. Ng3! h2 (1... Ke3 2. Nf1+) 2. Kb7 {Diag. 3.6} 2... Kd4 "
               "(2... Kc2 3. Kc6 Kd1 4. Kd5 Ke1 5. Ke4 Kf2 6. Kf4 $10) 3. Kc6 Ke5 4. Kc5 "
               "(4. Nh1 Ke4 5. Kc5 $10) 4... Kf4 5. Nh1 Kf3 6. Kd4 Kg2 7. Ke3! Kxh1 "
               "8. Kf2 $10 1/2-1/2"),
    dict(finale=13, diag="3.7", pages="59-60", photos=["12.12.51 (2)", "12.12.51 (3)"],
         fen="8/2K5/8/8/4N3/2k5/7p/8 b - - 0 1", camp="white",
         coups="1... Kc2 (1... Kd3?! 2. Ng3! $10 2... Kc2 3. Kd6 Kd1 4. Ke5 Ke1 5. Kf4 $10) "
               "(1... Kd4?! 2. Nf2! {Diag. 3.8} (2. Ng3? Ke5! 3. Kc6 Kf4 4. Nh1 Kf3 $19 "
               "5. Kd5 Kg2 6. Ke4) 2... Kc3 3. Kd6 Kd2 4. Ke5 Ke2 5. Nh1 Kf3 6. Kd4 Kg2 "
               "7. Ke3 Kxh1 8. Kf2 $10) 2. Ng3! (2. Nf2? Kd2 $19) 2... Kd1 3. Kd6 Ke1 "
               "4. Ke5 Kf2 5. Kf4 $10 1/2-1/2"),
    dict(finale=14, diag="3.9", pages="60-61", photos=["12.12.51 (3)", "12.13.09 (3)"],
         fen="8/8/8/8/8/p7/2K1N3/k7 w - - 0 1", camp="white",
         coups="1. Nc1! a2 2. Nb3# 1-0"),
    dict(finale=15, diag="3.10", pages="61", photos=["12.13.09 (3)"],
         fen="3k4/1n6/8/P7/8/8/7K/8 w - - 0 1", camp="white",
         coups="1. a6 Kc8 2. a7 $18 1-0"),
    # --- Chapitre 4 : Dame contre pion -----------------------------------
    dict(finale=16, diag="4.1", pages="63-64", photos=["12.12.51 (4)", "12.13.09 (4)"],
         fen="6K1/8/3Q4/8/8/8/5kp1/8 w - - 0 1", camp="white",
         coups="1. Qf4+ Ke2 2. Qg3! Kf1 3. Qf3+ Kg1 4. Kg7 Kh2 5. Qf2 Kh1 6. Qh4+ Kg1 "
               "7. Kg6 Kf1 8. Qf4+ Ke2 9. Qg3! Kf1 10. Qf3+ Kg1 11. Kg5 Kh2 12. Kh4! g1=Q "
               "13. Qh3# 1-0"),
    dict(finale=17, diag="4.3", pages="64-65", photos=["12.13.09 (4)", "12.13.09 (5)"],
         fen="8/5K1P/8/8/3q4/8/8/2k5 w - - 0 1", camp="white",
         coups="1. Kg8 Qd8+ 2. Kg7 Qg5+ 3. Kf7 Qh6 4. Kg8 Qg6+ 5. Kh8! Kd2 1/2-1/2"),
    dict(finale=17, diag="4.4", pages="65-66", photos=["12.13.09 (5)", "12.12.51 (5)"],
         fen="8/6KP/8/4k3/3q4/8/8/8 b - - 0 1", camp="black",
         coups="1... Qd7+ 2. Kg6 Qe6+ 3. Kg7 Qe7+ (3... Qf6+ 4. Kg8 Ke6! $19) 4. Kg8 "
               "(4. Kg6 Qf8 $19) 4... Kf6! 5. h8=Q+ Kg6 $19 {Diag. 4.5} 0-1"),
    dict(finale=18, diag="4.6", pages="66", photos=["12.12.51 (5)"],
         fen="8/5P2/3K4/8/8/1k6/8/q7 w - - 0 1", camp="white",
         coups="1. Ke7! (1. f8=Q?? Qa3+ $19) 1... Qe5+ 2. Kd7 Qf6 3. Ke8 Qe6+ 4. Kf8 Kc4 "
               "5. Kg7! Qe7 6. Kg8 Qg5+ 7. Kh8 Qf6+ 8. Kg8 Qg6+ 9. Kh8! $10 1/2-1/2"),
    dict(finale=18, diag="4.7", pages="67", photos=["12.12.51 (6)"],
         fen="8/5PK1/8/6k1/8/8/q7/8 b - - 0 1", camp="black",
         coups="1... Qa7! 2. Kh8 (2. Kg8) 2... Kg6 3. f8=Q Qh7# 0-1"),
    dict(finale=18, diag="4.8", pages="67-68", photos=["12.12.51 (6)", "12.12.52"],
         fen="8/4KP2/8/8/6k1/8/q7/8 b - - 0 1", camp="black",
         coups="1... Qa7+ 2. Ke8 Qb8+ 3. Ke7 Qe5+ 4. Kd7 Qf6 5. Ke8 Qe6+ 6. Kf8 Kg5! "
               "7. Kg7 Qe7! (7... Qd7?! 8. Kh8!?) 8. Kg8 Kg6 $19 0-1"),
    dict(finale=18, diag="4.9", pages="68", photos=["12.12.52"],
         fen="8/4KP2/8/1k6/8/8/q7/8 b - - 0 1", camp="black",
         coups="1... Qa3+! (1... Qa7+ 2. Kf8 (2. Kf6 Qd4+!) 2... Qg1) 2. Ke8 (2. Kf6 Qf8 $19) "
               "2... Qa8+ 3. Ke7 Qe4+! 4. Kf8 (4. Kf6 Qd4+ 5. Ke7 Qg7 6. Ke8 Kc6 $19) "
               "4... Qh7! (4... Kc6? 5. Kg7 $10) 5. Ke8 Kc6! 6. f8=Q Qd7# 0-1"),
    dict(finale=19, diag="4.10", pages="69", photos=["12.12.52 (1)"],
         fen="8/8/8/3K4/8/4Q3/2p5/1k6 w - - 0 1", camp="black",
         coups="1. Qb3+ Ka1! 2. Qe3 Kb1 3. Qe4 Kb2 4. Qe2 {Diag. 4.11} 4... Ka1! "
               "(4... Kb1?? 5. Kc4!! c1=Q+ 6. Kb3 $18) (4... Kc3?? 5. Qe5+! $18) "
               "5. Kc4 c1=Q+ 6. Kb3 Qb1+ $10 1/2-1/2"),
    dict(finale=19, diag="4.12", pages="70", photos=["12.13.09 (6)"],
         fen="8/8/8/4K3/8/1Q6/2pk4/8 w - - 0 1", camp="black",
         coups="1. Qb2 Kd1 2. Qb3 Kd2 3. Qa2!? Kc3! (3... Kd1?? 4. Kd4! c1=Q 5. Kd3 $18) "
               "(3... Kd3?? 4. Qb2 Kd2 5. Ke4 $18) 4. Qa1+ Kd2 $10 1/2-1/2"),
    dict(finale=20, diag="4.13", pages="70-71", photos=["12.13.09 (6)", "12.13.09 (7)"],
         fen="8/8/8/8/8/k2K4/2Q5/q7 w - - 0 1", camp="white",
         coups="1. Qc5+! Ka2 (1... Ka4?! 2. Qa7+ $18) (1... Kb3 2. Qb5+ Ka3 3. Qa5+ Kb2 "
               "4. Qb4+) (1... Kb2 2. Qb4+) 2. Qc4+! (2. Qa7+? Kb1 $10) 2... Ka3 "
               "(2... Kb2 3. Qb4+) 3. Qa6+ Kb2 4. Qb5+ Ka3 (4... Kc1 5. Qc4+ Kb2 6. Qb4+) "
               "5. Qa5+ Kb2 6. Qb4+ Ka2 (6... Kc1 7. Qd2+ Kb1 8. Qc2#) 7. Kc2! $18 1-0"),
]

# Diagrammes sans aucun coup dans le livre : la position seule.
SANS_COUPS = [
    dict(finale=9, diag="1.21", pages="41", photos=["12.12.50 (2)"],
         fen="8/8/8/8/8/6k1/r7/6NK w - - 0 1", camp="black", coups="*"),
    dict(finale=9, diag="1.22", pages="41", photos=["12.12.50 (2)"],
         fen="8/8/8/8/8/6k1/r7/6KN b - - 0 1", camp="black", coups="*"),
    dict(finale=9, diag="1.23", pages="41", photos=["12.12.50 (2)"],
         fen="r7/8/8/8/8/6k1/6N1/7K w - - 0 1", camp="black", coups="*"),
    dict(finale=16, diag="4.2", pages="64", photos=["12.13.09 (4)"],
         fen="2Q5/3K4/8/8/8/8/3kp3/8 w - - 0 1", camp="black", coups="*"),
]


def titres():
    with io.open(os.path.join(ICI, "finales.json"), encoding="utf-8") as f:
        return {f_["numero"]: f_["titre"] for f_ in json.load(f)}


def construire(c, titre):
    trait = "Blancs" if c["fen"].split()[1] == "w" else "Noirs"
    photos = [PHOTO.format(p) for p in c["photos"]]
    entete = [
        ("Event", "F{:02d} · Diag. {} · trait aux {}".format(c["finale"], c["diag"], trait)),
        ("Site", "de la Villa, Les 100 finales qu'il faut connaître, p.{}".format(c["pages"])),
        ("Round", str(c["finale"])),
        ("White", "?"), ("Black", "?"),
        ("FEN", c["fen"]), ("SetUp", "1"),
        ("Orientation", c["camp"]),
        ("Finale", "{} - {}".format(c["finale"], titre)),
        ("Diagramme", c["diag"]),
        ("Pages", c["pages"]),
        ("Photos", "; ".join(photos)),
    ]
    pgn = "".join('[{} "{}"]\n'.format(k, v) for k, v in entete)
    renvoi = "{{p.{} · {}}}".format(c["pages"], " · ".join(c["photos"]))
    pgn += "\n" + renvoi + " " + c["coups"] + "\n"

    jeu = chess.pgn.read_game(io.StringIO(pgn))
    if jeu.errors:
        raise SystemExit("F{} diag {} : {}".format(c["finale"], c["diag"], jeu.errors))
    if chess.Board(c["fen"]).fen() != jeu.board().fen():
        raise SystemExit("F{} diag {} : FEN refusée".format(c["finale"], c["diag"]))
    fin = jeu.end().board()
    jeu.headers["Result"] = c["coups"].split()[-1]
    return jeu, fin


def ecrire(nom, liste, noms):
    chemin = os.path.join(SORTIE, nom)
    textes = []
    for c in liste:
        jeu, fin = construire(c, noms[c["finale"]])
        textes.append(jeu.accept(chess.pgn.StringExporter(columns=80)))
        print("  F{:<2} {:<5} {:>3} demi-coups (principale)  {}".format(
            c["finale"], c["diag"], fin.ply() - chess.Board(c["fen"]).ply(),
            "mat" if fin.is_checkmate() else "pat" if fin.is_stalemate() else ""))
    with io.open(chemin, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n\n".join(textes) + "\n")
    print("-> {} ({} chapitres)".format(os.path.relpath(chemin, ICI), len(liste)))


def main():
    if not os.path.isdir(SORTIE):
        os.makedirs(SORTIE)
    noms = titres()
    ecrire("finales-01-20.pgn", CHAPITRES, noms)
    ecrire("positions-sans-coups.pgn", SANS_COUPS, noms)


if __name__ == "__main__":
    sys.exit(main())
