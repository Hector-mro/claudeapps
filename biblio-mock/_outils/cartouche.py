"""OCR du seul cartouche : coin bas-droit à 0° et à 180° (page scannée à l'envers), on garde le plus lisible."""
import os, re, subprocess, sys, tempfile, time
from multiprocessing import Pool
from pathlib import Path
from PIL import Image, ImageOps

LIB, OUT, ENGINE, DPI = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], int(sys.argv[4])
METHOD = f"cart_{ENGINE}{DPI}"


def crops(png):
    im = Image.open(png)
    for k, page in enumerate((im, im.rotate(180))):
        w, h = page.size
        c = page.crop((int(w * .50), int(h * .72), w, h))
        c = ImageOps.autocontrast(c, cutoff=1)
        p = png.replace(".png", f"_c{k}.png"); c.save(p); yield p


def read(p):
    if ENGINE == "tess":
        return subprocess.run(["tesseract", p, "-", "--psm", "11"], capture_output=True, text=True, timeout=60,
                              env={**os.environ, "OMP_THREAD_LIMIT": "1"}).stdout
    global _r
    if "_r" not in globals():
        from rapidocr_onnxruntime import RapidOCR; _r = RapidOCR()
    res, _ = _r(p)
    return "\n".join(r[1] for r in (res or []))


def page(png):
    t = time.time()
    best = max((read(c) for c in crops(png)), key=lambda s: len(re.findall(r"[A-Za-z0-9]{4,}", s)))
    return best, time.time() - t


if __name__ == "__main__":
    tot_t = tot_p = 0
    for pdf in sorted(LIB.rglob("*.pdf")):
        td = tempfile.mkdtemp()
        subprocess.run(["pdftoppm", "-r", str(DPI), "-gray", "-png", str(pdf), f"{td}/p"], check=True)
        pngs = sorted(str(p) for p in Path(td).glob("p-*.png"))
        with Pool(4) as pool: out = pool.map(page, pngs)
        (OUT / f"{METHOD}__{pdf.stem}.txt").write_text("\n".join(o[0] for o in out))
        tot_t += sum(o[1] for o in out); tot_p += len(pngs)
    print(METHOD, "s/page CPU:", round(tot_t / tot_p, 2))
