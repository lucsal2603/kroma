import sys
from rembg import remove, new_session
from PIL import Image
import io

# Coppie: (sorgente, output)  — front e retro per ogni colore
PAIRS = [
    ("/Users/lucas/Desktop/casco grigio.jpg",        "sz-grigio.png"),
    ("/Users/lucas/Desktop/grigio dietro.webp",       "sz-grigio-retro.png"),
    ("/Users/lucas/Desktop/casco nero.webp",          "sz-nero.png"),
    ("/Users/lucas/Desktop/nero.jpg",                 "sz-nero-retro.png"),
    ("/Users/lucas/Desktop/casco bianco.webp",        "sz-bianco.png"),
    ("/Users/lucas/Desktop/casco bianco dietro.jpg",  "sz-bianco-retro.png"),
]

OUT_DIR = "/Users/lucas/kroma/public/img"
session = new_session("isnet-general-use")  # modello con bordi piu' puliti

def trim(img):
    """Ritaglia il bounding box dei pixel non trasparenti, con un piccolo margine."""
    bbox = img.getbbox()
    if not bbox:
        return img
    pad = 12
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img.width, r + pad); b = min(img.height, b + pad)
    return img.crop((l, t, r, b))

for src, out in PAIRS:
    with open(src, "rb") as f:
        data = f.read()
    cut = remove(
        data,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=15,
        alpha_matting_erode_size=8,
    )
    img = Image.open(io.BytesIO(cut)).convert("RGBA")
    img = trim(img)
    img.save(f"{OUT_DIR}/{out}")
    print(f"OK {out}  {img.size}")
