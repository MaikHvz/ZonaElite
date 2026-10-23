"""Genera el fondo del hero (tono natural + aura de fuego tras el maestro) desde la foto original.

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


def grade(img: Image.Image, aura) -> Image.Image:
    """Tono natural con contraste cinematográfico y un aura naranja sutil
    detrás del maestro. `aura` = (cx, cy, rx, ry) normalizados al recorte."""
    w, h = img.size
    a = np.asarray(img).astype(np.float32) / 255.0

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = xx / w, yy / h

    # Bajar un poco la saturación (la foto viene muy "digital") sin teñirla
    lum = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])[..., None]
    a = lum + (a - lum) * 0.85

    # Contraste: curva S suave y negros más profundos
    a = np.clip((a - 0.04) / 0.94, 0, 1)
    a = 0.6 * a + 0.4 * (a * a * (3 - 2 * a))
    a = np.power(a, 1.12)

    # Fondo claro (techo, paredes, ventanas) en penumbra: se comprimen las
    # altas luces y se oscurecen techo y lado izquierdo (legibilidad del texto)
    l2 = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])[..., None]
    hi = np.clip((l2 - 0.55) / 0.35, 0, 1)
    a = a * (1 - 0.35 * hi)
    left_dark = np.clip(1 - (0.5 - nx) / 0.5, 0.45, 1)
    top_dark = np.clip(ny / 0.22, 0.5, 1)
    a = a * (0.82 * left_dark * top_dark)[..., None]

    # Aura del maestro: halo naranja suave (screen), más intenso hacia atrás
    def glow(cx, cy, rx, ry, color, strength):
        d = ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2
        return np.exp(-d)[..., None] * strength * np.array(color)

    acx, acy, arx, ary = aura
    halo = (
        glow(acx + arx * 0.45, acy, arx, ary, [1.0, 0.42, 0.10], 0.38)
        + glow(acx + arx * 0.6, acy - ary * 0.3, arx * 0.55, ary * 0.5, [1.0, 0.55, 0.18], 0.2)
    )
    a = 1 - (1 - a) * (1 - np.clip(halo, 0, 1))

    # Contorno cálido solo alrededor del maestro (efecto "aura")
    base = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    edges = np.asarray(
        base.convert("L").filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(3))
    ).astype(np.float32) / 255.0
    near = np.exp(-(((nx - acx) / (arx * 1.1)) ** 2 + ((ny - acy) / (ary * 1.1)) ** 2))
    a = a + (edges * near * 0.22)[..., None] * np.array([1.0, 0.5, 0.15])

    # Viñeta
    vd = ((nx - 0.55) / 0.75) ** 2 + ((ny - 0.45) / 0.8) ** 2
    a = a * np.clip(1 - vd * 0.5, 0.3, 1)[..., None]

    out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return add_sparks(out, aura)


def add_sparks(img: Image.Image, aura) -> Image.Image:
    """Chispas y brasas estáticas alrededor del aura (las animadas se hacen en CSS)."""
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
    acx, acy, arx, ary = aura
    # Brasas: pocas, alrededor del aura del maestro y algunas sueltas
    n = int(45 * (w * h) / (1600 * 900))
    for _ in range(n):
        if rng.random() < 0.75:
            x = w * (acx + rng.normal(0.1, 0.6) * arx)
            y = h * (acy + rng.normal(0, 0.7) * ary)
        else:
            x, y = w * rng.random(), h * rng.uniform(0.3, 1.0)
        r = scale * rng.uniform(0.8, 2.6)
        col = [1.0, rng.uniform(0.5, 0.75), rng.uniform(0.15, 0.3)]
        stamp(x, y, r, col, rng.uniform(0.35, 0.9))
        if r > 2.0 * scale:  # halo
            stamp(x, y, r * 4, [1.0, 0.4, 0.08], 0.1)

    # Chispas en trazo (motion blur diagonal) detrás del maestro
    m = int(14 * (w * h) / (1600 * 900))
    for _ in range(m):
        x = w * (acx + rng.uniform(0.0, 1.2) * arx)
        y = h * (acy + rng.uniform(-0.6, 0.9) * ary)
        length = scale * rng.uniform(10, 26)
        ang = np.deg2rad(rng.uniform(-75, -45))
        steps = 12
        for i in range(steps):
            t = i / steps
            stamp(
                x + np.cos(ang) * length * t,
                y + np.sin(ang) * length * t,
                scale * 0.8,
                [1.0, 0.6, 0.2],
                0.5 * (1 - t),
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
# aura del maestro (cx, cy, rx, ry) en coords normalizadas de este recorte
desk = grade(crop_desk, (0.80, 0.35, 0.20, 0.45))
desk.save(out_desk, quality=82, optimize=True, progressive=True)

# Mobile: recorte vertical centrado en el peleador y el coach
mx0 = int(W * 0.22)
crop_mob = full.crop((mx0, 800, mx0 + int(W * 0.7), 800 + int(W * 0.7 * 16 / 10)))
crop_mob = crop_mob.resize((1080, int(1080 * 16 / 10)), Image.LANCZOS)
mob = grade(crop_mob, (0.80, 0.25, 0.28, 0.30))
mob.save(out_mob, quality=80, optimize=True, progressive=True)
print("ok", desk.size, mob.size)
