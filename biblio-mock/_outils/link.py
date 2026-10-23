"""Rattachement équipements -> documents à partir des textes extraits (une méthode OCR donnée)."""
import csv, re, sys
from pathlib import Path

OCR, METHOD, MOCK = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
LIB = MOCK / "Bibliotheque"


def norm(t):
    return re.sub(r"[^A-Z0-9]", "", t.upper())


# Référentiel produit : signatures côté document (poids) et côté équipement (ordre = priorité).
CAT = {
    "unoq": ({"QRB2210": 3, "STM32U585": 3, "ABX00162": 3}, ["ABX00162", "UNOQ"]),
    "every": ({"ATMEGA4809": 3, "NANOEVERY": 3}, ["ABX00028", "NANOEVERY"]),
    "mega": ({"ATMEGA2560": 3, "MEGA2560": 3}, ["A000067", "MEGA2560", "MEGA"]),
    "motor": ({"L298": 3, "MOTORSHIELD": 3}, ["A000079", "MOTEUR"]),
    "relays4": ({"4RELAYS": 3, "RELAYSSHIELD": 3}, ["A000110", "4RELAIS"]),
    "ethernet": ({"W5500": 3, "ETHERNETSHIELD": 3}, ["A000024", "ETHERNET"]),
    "due": ({"SAM3X": 3, "DUEV0": 3}, ["A000056", "DUE"]),
    "opta": ({"OPTA": 3, "AFX0000": 3, "STM32H747": 1}, ["AFX0000", "OPTA"]),
    "pmc": ({"AKX00032": 3, "MACHINECONTROL": 3}, ["AKX00032", "MACHINECONTROL"]),
    "nano": ({"FT232": 3, "NANOV3": 3, "ATMEGA328": 1}, ["A000005", "NANO"]),
    "vidor": ({"10CL0": 3, "VIDOR": 3, "SAMD21": 1}, ["ABX00022", "VIDOR"]),
    "h7": ({"STM32H747": 2, "PORTENTAH7": 3, "ABX00042": 3}, ["ABX00042", "PORTENTAH7"]),
    "r4wifi": ({"RA4M1": 3, "ESP32S3": 3, "ABX00087": 3}, ["ABX00087", "R4WIFI"]),
    "leonardo": ({"ATMEGA32U4": 3, "LEONARDO": 3}, ["A000057", "LEONARDO"]),
    "thermo": ({"HS3003": 3, "MODULINO": 3}, ["ABX00103", "MODULINO"]),
    "mkrrelay": ({"TSX00003": 3, "MKRRELAY": 3, "MKRRELAYPROTO": 3}, ["TSX00003", "MKRRELAY"]),
    "uno": ({"ATMEGA16U2": 1, "ATMEGA328P": 2, "UNOTH": 3}, ["A000066", "UNO"]),
}
STOP = {"CARTE", "ARDUINO", "LIGNE", "POSTE", "MODULE", "EN", "DE", "DU", "LA", "LE", "ANCIEN", "SPARE", "MEME", "QUE", "CONFIG"}

docs = {}
for pdf in sorted(LIB.rglob("*.pdf")):
    f = OCR / f"{METHOD}__{pdf.stem}.txt"
    txt = f.read_text() if f.exists() else ""
    meta = str(pdf.relative_to(LIB))  # chemin + nom de fichier : métadonnée gratuite
    docs[pdf.stem] = {"n": norm(txt), "meta": norm(meta), "raw": txt}


def doc_products(d):
    out = {}
    for p, (sig, _) in CAT.items():
        s = sum(w for t, w in sig.items() if t in d["n"] or t in d["meta"])
        if s >= 2: out[p] = s
    # une signature faible déjà expliquée par un produit fort ne compte pas seule (ex. STM32H747 dans l'Opta)
    if "opta" in out and out.get("h7", 0) <= 2: out.pop("h7", None)
    if ("mega" in out or "nano" in out) and out.get("uno", 0) <= 3: out.pop("uno", None)
    return out


def eq_product(row):
    n = norm(" ".join([row["Réf. fabricant"], row["Désignation"], row["Commentaire"]]))
    for p, (_, esig) in CAT.items():
        if any(t in n for t in esig): return p
    return None


rows = list(csv.DictReader(open(MOCK / "equipements.csv", encoding="utf-8-sig"), delimiter=";"))
truth = {r["ID"]: r["doc_attendu"] for r in csv.DictReader(open(MOCK / "_verite_equipements.csv"), delimiter=";")}
byid = {r["ID"]: r for r in rows}
dp = {k: doc_products(d) for k, d in docs.items()}


def site_bonus(row, stem):
    m = docs[stem]["meta"]
    return sum(1 for v in (row["Site"], row["Localisation"]) if v and norm(v) in m)


def link_L2(row):
    p = eq_product(row)
    if not p and row["Équipement parent"] in byid:  # hérite du contexte du parent : non, produit inconnu
        return ""
    cands = [k for k, ps in dp.items() if p in ps]
    if not cands: return ""
    return max(cands, key=lambda k: (site_bonus(row, k), dp[k][p]))


def link_L1(row):
    terms = {t for t in re.findall(r"[A-Z0-9]{3,}", " ".join([row["Réf. fabricant"], row["Désignation"], row["Commentaire"]]).upper()) if t not in STOP}
    best, bs = "", 0
    for k, d in docs.items():
        s = sum(1 for t in terms if t in d["n"] or t in d["meta"]) * 2 + site_bonus(row, k)
        if s > bs: best, bs = k, s
    return best if bs >= 2 else ""


res = {}
for name, fn in (("L1_lexical", link_L1), ("L2_referentiel", link_L2)):
    ok = [(i, fn(byid[i]), t) for i, t in truth.items()]
    good = sum(1 for _, p, t in ok if p in t.split("|") or p == t)
    res[name] = good
    errs = [f"{i}:{p or '-'}≠{t or '-'}" for i, p, t in ok if not (p in t.split("|") or p == t)]
    print(f"{METHOD:22s} {name:15s} {good}/{len(ok)}  erreurs: {' '.join(errs)}")
ident = sum(1 for k in docs if dp[k])
print(f"{METHOD:22s} docs avec produit identifié: {ident}/16  {dict((k, sorted(v)) for k, v in dp.items() if v)}")
