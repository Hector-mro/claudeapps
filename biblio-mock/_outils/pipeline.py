"""Pipeline en cascade, page par page : cartouche (0° + 180°) puis page entière seulement si rien n'est identifié."""
import json, re, subprocess, sys, tempfile, time
from multiprocessing import Pool
from pathlib import Path
from PIL import Image, ImageOps

LIB, OUT, LINK = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
DPI = 200
ns = {"re": re}
src = LINK.read_text()
exec(src[src.index("def norm"):src.index("STOP =")], ns)
norm, CAT = ns["norm"], ns["CAT"]


def products(txt):
    n = norm(txt)
    return sorted(p for p, (sig, _) in CAT.items() if sum(w for t, w in sig.items() if t in n) >= 2)


def ocr(img):
    global _r
    if "_r" not in globals():
        from rapidocr_onnxruntime import RapidOCR; _r = RapidOCR()
    res, _ = _r(img)
    return "\n".join(r[1] for r in (res or []))


def page(png):
    t = time.time(); im = Image.open(png)
    parts = []
    for page_img in (im, im.rotate(180)):
        w, h = page_img.size
        c = ImageOps.autocontrast(page_img.crop((int(w * .5), int(h * .72), w, h)), cutoff=1)
        p = png.replace(".png", f"_{len(parts)}.png"); c.save(p); parts.append(ocr(p))
    txt, stage = "\n".join(parts), "cartouche"
    if not products(txt):
        txt += "\n" + ocr(png); stage = "page"
    return {"stage": stage, "s": time.time() - t, "txt": txt, "prod": products(txt)}


if __name__ == "__main__":
    log = {}
    for pdf in sorted(LIB.rglob("*.pdf")):
        td = tempfile.mkdtemp()
        subprocess.run(["pdftoppm", "-r", str(DPI), "-gray", "-png", str(pdf), f"{td}/p"], check=True)
        pngs = sorted(str(p) for p in Path(td).glob("p-*.png"))
        with Pool(4) as pool: out = pool.map(page, pngs)
        (OUT / f"pipeline__{pdf.stem}.txt").write_text("\n".join(o["txt"] for o in out))
        log[pdf.stem] = [(o["stage"], round(o["s"], 1), o["prod"]) for o in out]
    pages = [p for v in log.values() for p in v]
    full = sum(1 for p in pages if p[0] == "page")
    print(f"pages: {len(pages)}, repli page entière: {full}, s/page CPU moyen: {sum(p[1] for p in pages) / len(pages):.1f}")
    print(f"pages sans produit après cascade: {sum(1 for p in pages if not p[2])}")
    json.dump(log, open(OUT / "pipeline_log.json", "w"), ensure_ascii=False, indent=0)
