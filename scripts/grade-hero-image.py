"""Genera el fondo del hero (estilo 'fuego cinematográfico') desde la foto original.

Requiere Pillow y numpy (pip install pillow numpy).
Uso:
  python scripts/grade-hero-image.py public/original.jpg public/hero-fire.jpg public/hero-fire-mobile.jpg

Los recortes (crop_desk / crop_mob) están calibrados para public/original.jpg;
si cambia la foto, hay que reajustarlos.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

rng = np.random.default_rng(7)

src, out_desk, out_mob = sys.argv[1:4]
full = Image.open(src).convert("RGB")
W, H = full.size  # 2624x3936


def grade(img: Image.Image, people_box) -> Image.Image:
    w, h = img.size
    a = np.asarray(img).astype(np.float32) / 255.0

    # Luminancia
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

    # Máscara "fondo brillante" (techo, focos, ventanas, lona blanca):
    # se oscurece mucho para que todo lo plano quede en penumbra.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = xx / w, yy / h
    x0, y0, x1, y1 = people_box
    # distancia normalizada a la caja de los personajes (0 adentro)
    dx = np.maximum(0, np.maximum(x0 - nx, nx - x1))
    dy = np.maximum(0, np.maximum(y0 - ny, ny - y1))
    outside = np.clip(np.sqrt(dx**2 + dy**2) * 4.0, 0, 1)

    # Gradient map "fuego": negro -> rojo profundo -> naranja -> ámbar -> crema
    stops = np.array([0.0, 0.18, 0.42, 0.68, 1.0])
    cols = np.array([
        [0.00, 0.00, 0.00],
        [0.22, 0.03, 0.01],
        [0.85, 0.26, 0.05],
        [1.00, 0.62, 0.22],
        [1.00, 0.92, 0.75],
    ])
    lc = np.clip(lum, 0, 1)
    fm = np.stack([np.interp(lc, stops, cols[:, c]) for c in range(3)], -1)

    # Peso del gradient map: más fuerte fuera de la cara/cuerpos (fondo),
    # y en la mitad derecha (detrás de la reja), más suave sobre la piel.
    right = np.clip((nx - 0.45) / 0.4, 0, 1)
    wmap = (0.32 + 0.45 * right + 0.2 * outside)[..., None]
    a = a * (1 - wmap) + fm * wmap

    # Contraste fuerte: curva S y negros aplastados
    a = np.clip((a - 0.05) / 0.9, 0, 1)
    a = a * a * (3 - 2 * a)
    a = np.power(a, 1.15)

    # Lado izquierdo y techo en penumbra (dramatismo + legibilidad del texto)
    left_dark = np.clip(1 - (0.55 - nx) / 0.55, 0.35, 1)
    top_dark = np.clip(ny / 0.25, 0.55, 1)
    a = a * (left_dark * top_dark)[..., None] * (1 - 0.4 * outside[..., None])

    # Luz de fuego: halo naranja a la derecha y abajo (screen)
    def glow(cx, cy, rx, ry, color, strength):
        d = ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2
        g = np.exp(-d)[..., None] * strength
        return g * np.array(color)

    fire = (
        glow(1.00, 0.60, 0.22, 0.45, [1.0, 0.33, 0.04], 0.55)
        + glow(0.85, 1.08, 0.35, 0.22, [1.0, 0.28, 0.03], 0.55)
        + glow(0.15, 1.10, 0.30, 0.18, [0.9, 0.18, 0.02], 0.35)
        + glow(0.62, 0.50, 0.12, 0.30, [1.0, 0.40, 0.08], 0.20)
    )
    a = 1 - (1 - a) * (1 - np.clip(fire, 0, 1))

    # Rim light cálido sobre bordes de los personajes (realce del contorno)
    base = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    edges = np.asarray(
        base.convert("L").filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(2))
    ).astype(np.float32) / 255.0
    rim = (edges * (1 - outside) * 0.35)[..., None] * np.array([1.0, 0.45, 0.12])
    a = a + rim

    # Viñeta
    vd = ((nx - 0.55) / 0.75) ** 2 + ((ny - 0.45) / 0.8) ** 2
    vig = np.clip(1 - vd * 0.55, 0.25, 1)[..., None]
    a = a * vig

    out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return add_sparks(out, people_box)


def add_sparks(img: Image.Image, people_box) -> Image.Image:
    """Chispas y brasas estáticas (las animadas se hacen en CSS)."""
    w, h = img.size
    layer = Image.new("RGB", (w, h), (0, 0, 0))
    px = np.zeros((h, w, 3), np.float32)

    def stamp(x, y, r, color, intensity):
        x0, x1 = int(max(0, x - r * 3)), int(min(w, x + r * 3))
        y0, y1 = int(max(0, y - r * 3)), int(min(h, y + r * 3))
        if x1 <= x0 or y1 <= y0:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        d2 = ((xx - x) ** 2 + (yy - y) ** 2) / (r * r)
        px[y0:y1, x0:x1] += np.exp(-d2)[..., None] * np.array(color) * intensity

    scale = w / 1600
    # Brasas: más densas a la derecha y abajo
    n = int(110 * (w * h) / (1600 * 900))
    for _ in range(n):
        x = w * (rng.beta(2.2, 1.2))
        y = h * (rng.beta(1.6, 1.0))
        if rng.random() < 0.35:
            x = w * rng.random()
        r = scale * rng.uniform(1.0, 3.4)
        col = [1.0, rng.uniform(0.45, 0.75), rng.uniform(0.1, 0.25)]
        stamp(x, y, r, col, rng.uniform(0.5, 1.4))
        if r > 1.8 * scale:  # halo
            stamp(x, y, r * 5, [1.0, 0.35, 0.05], 0.18)

    # Chispas en trazo (motion blur diagonal), lado derecho
    m = int(55 * (w * h) / (1600 * 900))
    for _ in range(m):
        x = w * rng.uniform(0.55, 1.0)
        y = h * rng.uniform(0.2, 1.0)
        length = scale * rng.uniform(14, 40)
        ang = np.deg2rad(rng.uniform(-75, -45))
        steps = 16
        for i in range(steps):
            t = i / steps
            stamp(
                x + np.cos(ang) * length * t,
                y + np.sin(ang) * length * t,
                scale * 0.9,
                [1.0, 0.55, 0.15],
                0.85 * (1 - t),
            )

    layer = Image.fromarray((np.clip(px, 0, 1) * 255).astype(np.uint8))
    # Screen blend
    a = np.asarray(img).astype(np.float32) / 255.0
    b = np.asarray(layer).astype(np.float32) / 255.0
    out = 1 - (1 - a) * (1 - b)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


# Desktop: banda horizontal desde la parte alta de la jaula hasta la cintura
crop_desk = full.crop((0, 940, W, 940 + int(W * 9 / 16)))
crop_desk = crop_desk.resize((2400, int(2400 * 9 / 16)), Image.LANCZOS)
# caja de personajes en coords normalizadas de este recorte
desk = grade(crop_desk, (0.05, 0.0, 0.95, 1.0))
desk.save(out_desk, quality=82, optimize=True, progressive=True)

# Mobile: recorte vertical centrado en el peleador y el coach
mx0 = int(W * 0.22)
crop_mob = full.crop((mx0, 800, mx0 + int(W * 0.7), 800 + int(W * 0.7 * 16 / 10)))
crop_mob = crop_mob.resize((1080, int(1080 * 16 / 10)), Image.LANCZOS)
mob = grade(crop_mob, (0.0, 0.0, 1.0, 0.9))
mob.save(out_mob, quality=80, optimize=True, progressive=True)
print("ok", desk.size, mob.size)
