"""Banc OCR : pour chaque méthode, temps par page et taux d'identification des documents."""
import json, os, re, subprocess, sys, tempfile, time
from multiprocessing import Pool
from pathlib import Path

LIB = Path(sys.argv[1]); OUTDIR = Path(sys.argv[2]); OUTDIR.mkdir(exist_ok=True)
METHODS = sys.argv[3].split(",")

# mots-clés identifiants attendus, par (fichier, sous-document)
EXPECT = {
    "scan_20190412_0031": {"uno": ["ATMEGA328", "ATMEGA16U2"]},
    "Carte cde convoyeur MEGA": {"mega": ["ATMEGA2560"]},
    "scan_20190412_0032": {"motor": ["L298"], "relays": ["RELAY"], "ethernet": ["W5500"]},
    "DOC0457": {"due": ["SAM3X"]},
    "ARM-L4-02_schemas_elec": {"opta": ["OPTA", "STM32H747", "AFX0000"]},
    "scan_2021-03-08_lot2": {"pmc": ["AKX00032", "MACHINE CONTROL"]},
    "IMG_20200917_0004": {"nano": ["ATMEGA328", "FT232"]},
    "vidor_SCH_v1": {"vidor": ["10CL025", "VIDOR", "SAMD21"]},
    "UNO-Q_schematics_rev": {"unoq": ["QRB2210", "STM32U585"]},
    "ABX00042-schematics": {"h7": ["STM32H747"]},
    "ABX00087-schematics": {"r4wifi": ["RA4M1", "ESP32-S3", "ESP32S3"]},
    "A000057-schematics": {"leonardo": ["ATMEGA32U4"]},
    "A000057-full-pinout": {"leo_pinout": ["LEONARDO", "ATMEGA32U4"]},
    "ABX00028-schematics": {"every": ["ATMEGA4809"]},
    "ABX00103-schematics": {"thermo": ["HS3003", "MODULINO"]},
    "relay shield MKR": {"mkrrelay": ["RELAY"]},
}


def norm(t):
    return re.sub(r"[^A-Z0-9-]", "", t.upper().replace(" ", ""))


def hits(text):
    n = norm(text)
    return {k: any(norm(w) in n for w in ws) for k, ws in EXPECT_cur.items()}


def tess(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=90,
                              env={**os.environ, "OMP_THREAD_LIMIT": "1"}).stdout
    except subprocess.TimeoutExpired:
        return ""


def ocr_page(args):
    method, png = args
    t = time.time()
    if method.startswith("tess"):
        psm = "11" if "sparse" in method else "3"
        cmd = ["tesseract", png, "-", "--psm", psm]
        txt = tess(cmd)
        if "osd" in method:  # second passage à 180° si peu de texte reconnu
            from PIL import Image
            rot = png.replace(".png", "_r.png"); Image.open(png).rotate(180).save(rot)
            t2 = tess(["tesseract", rot, "-", "--psm", psm])
            if len(re.findall(r"[A-Za-z]{4,}", t2)) > len(re.findall(r"[A-Za-z]{4,}", txt)):
                txt = t2
    elif method.startswith("rapid"):
        from rapidocr_onnxruntime import RapidOCR
        global _r
        if "_r" not in globals(): _r = RapidOCR()
        res, _ = _r(png)
        txt = "\n".join(r[1] for r in (res or []))
    return txt, time.time() - t


if __name__ == "__main__":
    pdfs = sorted(LIB.rglob("*.pdf"))
    report = {}
    for method in METHODS:
        dpi = int(re.search(r"(\d+)$", method).group(1)) if re.search(r"\d+$", method) else 200
        rows, total_t, total_p = {}, 0.0, 0
        for pdf in pdfs:
            EXPECT_cur = EXPECT[pdf.stem]
            if method == "pdftotext":
                t = time.time(); txt = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True).stdout
                dt = time.time() - t; npages = 1
            else:
                td = tempfile.mkdtemp()
                subprocess.run(["pdftoppm", "-r", str(dpi), "-gray", "-png", str(pdf), f"{td}/p"], check=True)
                pngs = sorted(str(p) for p in Path(td).glob("*.png"))
                with Pool(4) as pool:
                    out = pool.map(ocr_page, [(method, p) for p in pngs])
                txt = "\n".join(o[0] for o in out); dt = sum(o[1] for o in out); npages = len(pngs)
            (OUTDIR / f"{method}__{pdf.stem}.txt").write_text(txt)
            rows[pdf.stem] = hits(txt); total_t += dt; total_p += npages
        found = sum(v for r in rows.values() for v in r.values()); n = sum(len(r) for r in rows.values())
        report[method] = {"identifies": f"{found}/{n}", "s_par_page_cpu": round(total_t / max(total_p, 1), 2),
                          "rates": [f"{d}:{k}" for d, r in rows.items() for k, v in r.items() if not v]}
        print(method, json.dumps(report[method], ensure_ascii=False), flush=True)
    json.dump(report, open(OUTDIR / f"report_{'_'.join(METHODS)}.json", "w"), ensure_ascii=False, indent=1)
