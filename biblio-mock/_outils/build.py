"""Construit la bibliothèque mock à partir des PDF Arduino téléchargés."""
import csv, random, shutil, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

RAW = Path(sys.argv[1])
OUT = Path(sys.argv[2])
LIB = OUT / "Bibliotheque"
random.seed(42); np.random.seed(42)

# (source(s), chemin cible, scanné ?, titre réel, réf fabricant)
DOCS = [
    (["A000066"], "01_Site_Lyon/Atelier_Usinage/Ligne_3/scan_20190412_0031.pdf", True, "Arduino UNO Rev3 - schéma", "A000066"),
    (["A000067"], "01_Site_Lyon/Atelier_Usinage/Ligne_3/Carte cde convoyeur MEGA.pdf", True, "Arduino MEGA 2560 Rev3 - schéma", "A000067"),
    (["A000079", "A000110", "A000024"], "01_Site_Lyon/Atelier_Usinage/Ligne_3/scan_20190412_0032.pdf", True,
     "Classeur : Motor Shield Rev3 + 4 Relays Shield + Ethernet Shield Rev2", "A000079;A000110;A000024"),
    (["A000056"], "01_Site_Lyon/Atelier_Usinage/Ligne_4/DOC0457.pdf", True, "Arduino DUE - schéma", "A000056"),
    (["AFX00001-AFX00002-AFX00003"], "01_Site_Lyon/Atelier_Usinage/Armoires/ARM-L4-02_schemas_elec.pdf", True,
     "Arduino Opta (automate) - schéma", "AFX00001/2/3"),
    (["AKX00032"], "02_Site_Grenoble/Maintenance/Archives/scan_2021-03-08_lot2.pdf", True,
     "Portenta Machine Control - schéma", "AKX00032"),
    (["A000005"], "02_Site_Grenoble/Maintenance/Archives/IMG_20200917_0004.pdf", True, "Arduino Nano - schéma", "A000005"),
    (["ABX00022"], "02_Site_Grenoble/Labo_Vision/vidor_SCH_v1.pdf", True, "MKR Vidor 4000 (FPGA) - schéma", "ABX00022"),
    (["ABX00162"], "02_Site_Grenoble/Labo_Vision/UNO-Q_schematics_rev.pdf", False, "Arduino UNO Q (Qualcomm, GPU Adreno) - schéma", "ABX00162"),
    (["ABX00042"], "02_Site_Grenoble/Labo_Vision/ABX00042-schematics.pdf", False, "Portenta H7 - schéma", "ABX00042"),
    (["ABX00087"], "Documentation_Constructeur/Arduino/UNO R4 WiFi/ABX00087-schematics.pdf", False, "Arduino UNO R4 WiFi - schéma", "ABX00087"),
    (["A000057"], "Documentation_Constructeur/Arduino/Leonardo/A000057-schematics.pdf", False, "Arduino Leonardo - schéma", "A000057"),
    (["A000057-full-pinout"], "Documentation_Constructeur/Arduino/Leonardo/A000057-full-pinout.pdf", False, "Arduino Leonardo - brochage", "A000057"),
    (["ABX00028"], "Documentation_Constructeur/Arduino/Nano Every/ABX00028-schematics.pdf", False, "Arduino Nano Every - schéma", "ABX00028"),
    (["ABX00103"], "Documentation_Constructeur/Arduino/divers/ABX00103-schematics.pdf", False, "Modulino Thermo - schéma", "ABX00103"),
    (["TSX00003"], "Documentation_Constructeur/Arduino/divers/relay shield MKR.pdf", False, "MKR Relay Proto Shield - schéma", "TSX00003"),
]


def src(stem):
    p = RAW / f"{stem}.pdf"
    return p if p.exists() else RAW / f"{stem}-schematics.pdf"


def scanify(pdfs, dest):
    """Rastérise en niveaux de gris, ajoute rotation, bruit, flou et JPEG : un PDF image sans texte."""
    pages = []
    with tempfile.TemporaryDirectory() as td:
        for i, pdf in enumerate(pdfs):
            subprocess.run(["pdftoppm", "-r", "110", "-gray", "-png", str(pdf), f"{td}/d{i}"], check=True)
        for png in sorted(Path(td).glob("*.png")):
            im = Image.open(png).convert("L")
            im = im.rotate(random.uniform(-1.4, 1.4), expand=True, fillcolor=235)
            a = np.asarray(im, dtype=np.float32)
            a = a * 0.86 + 22  # papier un peu gris, encre moins noire
            a += np.random.normal(0, 9, a.shape)
            # bande sombre sur un bord (ombre de scanner)
            w = a.shape[1]; a[:, : w // 60] *= 0.55
            im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
            if random.random() < 0.2:
                im = im.rotate(180)  # page mise à l'envers dans le chargeur
            pages.append(im)
    pages[0].save(dest, "PDF", save_all=True, append_images=pages[1:], resolution=110, quality=55)
    return len(pages)


rows = []
for stems, rel, scanned, title, ref in DOCS:
    dest = LIB / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    pdfs = [src(s) for s in stems]
    if scanned:
        n = scanify(pdfs, dest)
    else:
        shutil.copy(pdfs[0], dest)
        n = int(subprocess.run(["pdfinfo", str(dest)], capture_output=True, text=True).stdout.split("Pages:")[1].split()[0])
    rows.append({"chemin": str(dest.relative_to(OUT)), "pages": n, "scanne": "oui" if scanned else "non",
                 "contenu_reel": title, "ref_fabricant": ref})
    print(n, rel)

with open(OUT / "_verite_terrain.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]), delimiter=";")
    w.writeheader(); w.writerows(rows)
print("total pages:", sum(r["pages"] for r in rows))
