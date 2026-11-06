#!/usr/bin/env python3
"""
Derive Pip's puppet layers from the three source renders.

The originals (pip.png, pip-blink.png, pip-walk.png) came out of the image model
with different framing, different crops, and in the blink case a black plate
behind the character. Dropping them straight into an <img> meant the character
jumped size and pose every time the pose changed, which reads as floating.

This script does three things and writes the result to public/mascot:

1. Removes a border-connected near-black plate (the blink render has one).
2. Normalises every render onto the same 512 canvas: same character height,
   same foot baseline, same horizontal centroid. Nothing jumps any more.
3. Splits the standing render at the ankle line into a body layer and two foot
   layers, so the feet can be animated independently. That is what turns a
   picture that slides across the screen into a character that steps.

Requires Pillow: python3 -m pip install pillow
Run from frontend/:  python3 scripts/mascot/build-sprites.py

The numbers it prints are the ones assets.ts needs (foot origins, baselines).
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

CANVAS = 512
CHAR_H = 470
BASELINE = 496
# Ankle line. Below this only feet are left (see the row scan in the header of
# assets.ts); cutting here keeps the seam under the body silhouette.
ANKLE_Y = 452
# Each foot keeps a stub of leg above the ankle cut. The stub is a duplicate of
# the body pixels, so it is invisible at rest and keeps the joint closed when the
# foot swings. Without it a lifted foot shows the body's flat cut edge.
STUB = 22
# Eye whites found by clustering bright pixels in the head (see EYES below).
# (x0, y0, x1, y1) on the normalised canvas.
EYES = ((266, 151, 284, 166), (305, 145, 331, 164))

ART = Path(__file__).resolve().parent / "source"
OUT = Path(__file__).resolve().parents[2] / "public" / "mascot"


def strip_plate(im: Image.Image, threshold: int = 40) -> Image.Image:
    """Clear border-connected near-black pixels (an opaque plate behind Pip)."""
    a = np.array(im).astype(np.uint8)
    rgb = a[:, :, :3].astype(int)
    alpha = a[:, :, 3]
    dark = (rgb.sum(axis=2) < threshold) & (alpha > 0)
    h, w = dark.shape
    seen = np.zeros_like(dark)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if dark[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if dark[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))

    a[:, :, 3] = np.where(seen, 0, alpha)
    return Image.fromarray(a)


def normalise(im: Image.Image) -> Image.Image:
    """Same character height, same ground line, same centroid on every render."""
    alpha = np.array(im)[:, :, 3]
    ys, xs = np.where(alpha > 12)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    scale = CHAR_H / crop.size[1]
    size = (max(1, round(crop.size[0] * scale)), CHAR_H)
    crop = crop.resize(size, Image.LANCZOS)

    mask = np.array(crop)[:, :, 3] > 12
    cx = int(np.argwhere(mask)[:, 1].mean())
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(crop, (CANVAS // 2 - cx, BASELINE - CHAR_H), crop)
    return canvas



def synth_blink(im: Image.Image, eyes, feather: float = 1.4) -> Image.Image:
    """Close the eyes in place.

    The supplied blink render is a different pose: 32% of its pixels differ from
    the standing render, so cross-fading to it read as a full-body flicker. A
    closed eye is only the eyeball replaced by cheek and a lid line, which is
    what this paints, so the blink happens in place and nothing else moves.
    """
    a = np.array(im).astype(float)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]

    for x0, y0, x1, y1 in eyes:
        pad = 3
        bx0, by0, bx1, by1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        rx, ry = (x1 - x0) / 2 + pad, (y1 - y0) / 2 + pad

        # Cheek tone: brightest tercile of the ring around the eye, so the patch
        # matches the lit side of the face rather than the darker outline.
        ring = []
        for y in range(by0, by1 + 1):
            for x in range(bx0, bx1 + 1):
                inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
                if not inside and a[y, x, 3] > 200:
                    ring.append(a[y, x, :3])
        ring = np.array(ring)
        bright = ring[ring.sum(axis=1) >= np.percentile(ring.sum(axis=1), 62)]
        cheek = np.median(bright, axis=0)

        mask = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
        dist = (1 - np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)) * min(rx, ry)
        soft = np.clip(dist / feather, 0, 1)
        alpha_new = a[:, :, 3] * mask * soft
        for c in range(3):
            a[:, :, c] = np.where(alpha_new > 0, cheek[c] * 0.92 + a[:, :, c] * 0.08, a[:, :, c])

        # Lid: a shallow arc across the eye, darker than the cheek.
        lid = cheek * 0.42
        for x in range(x0 - 1, x1 + 2):
            t = (x - cx) / rx
            if abs(t) > 1:
                continue
            y = cy + 0.9 - 1.1 * np.sqrt(max(0.0, 1 - t * t))
            for dy in (0, 1):
                yi = int(round(y)) + dy
                if 0 <= yi < h:
                    a[yi, x, :3] = lid

    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def mask_to_eyes(im: Image.Image, eyes, pad: int = 16, feather: int = 6) -> Image.Image:
    """Keep a feathered window over the eyes and nothing else."""
    a = np.array(im).astype(float)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    x0 = min(e[0] for e in eyes) - pad
    x1 = max(e[2] for e in eyes) + pad
    y0 = min(e[1] for e in eyes) - pad
    y1 = max(e[3] for e in eyes) + pad
    box = (
        np.minimum(xx - x0, x1 - xx).clip(0, feather)
        * np.minimum(yy - y0, y1 - yy).clip(0, feather)
        / (feather * feather)
    )
    outside = np.where((xx < x0) | (xx > x1) | (yy < y0) | (yy > y1), 0.0, 1.0)
    a[:, :, 3] *= box * outside
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def feet_masks(im: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    """Left / right foot masks below the ankle line, feathered at the seam."""
    alpha = np.array(im)[:, :, 3]
    h, w = alpha.shape
    solid = alpha > 12
    left = np.zeros_like(solid)
    right = np.zeros_like(solid)

    seen = np.zeros_like(solid)
    for y in range(ANKLE_Y, h):
        for x in range(w):
            if not solid[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            pts = []
            while q:
                cy, cx = q.popleft()
                pts.append((cy, cx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if ANKLE_Y <= ny < h and 0 <= nx < w and solid[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
            if len(pts) < 40:
                continue
            mean_x = sum(p[1] for p in pts) / len(pts)
            target = left if mean_x < w / 2 else right
            for py, px in pts:
                target[py, px] = True

    # Hard ownership on purpose: the stub above the ankle hides the seam, so a
    # feather here would only make the two layers overlap semi transparently.
    return left.astype(float), right.astype(float)


def add_stub(mask: np.ndarray, ankle: int, height: int) -> np.ndarray:
    """Add a leg stub above the ankle over the foot's own columns.

    The stub duplicates body pixels that are still drawn, so it never shows at
    rest and the leg stays continuous while the foot swings.
    """
    out = mask.copy()
    cols = np.where(mask.any(axis=0))[0]
    if len(cols) == 0:
        return out
    out[max(0, ankle - height) : ankle, cols.min() : cols.max() + 1] = 1.0
    return out


def layer(im: Image.Image, keep: np.ndarray) -> Image.Image:
    a = np.array(im).astype(float)
    a[:, :, 3] = np.clip(a[:, :, 3] * keep, 0, 255)
    return Image.fromarray(a.round().astype(np.uint8))


def bbox(im: Image.Image) -> tuple[int, int, int, int]:
    alpha = np.array(im)[:, :, 3]
    ys, xs = np.where(alpha > 12)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def main() -> None:
    idle = normalise(strip_plate(Image.open(ART / "pip.png").convert("RGBA")))
    # Only the eye patch is emitted, so the blink layer can sit over the rig
    # without ever covering a foot that is mid stride.
    blink = mask_to_eyes(synth_blink(idle, EYES), EYES)

    left_leg, right_leg = feet_masks(idle)
    # The body only gives up the pixels below the ankle. The stub above it stays
    # in both layers, which is what keeps the joint closed mid stride.
    ownership = np.clip(left_leg + right_leg, 0, 1)
    body_mask = 1.0 - ownership
    left_mask = np.clip(left_leg + add_stub(left_leg, ANKLE_Y, STUB), 0, 1)
    right_mask = np.clip(right_leg + add_stub(right_leg, ANKLE_Y, STUB), 0, 1)

    body = layer(idle, body_mask)
    foot_l = layer(idle, left_mask)
    foot_r = layer(idle, right_mask)

    # Full standing render, used for the README and for social previews.
    idle.save(OUT / "pip.png", optimize=True)
    blink.save(OUT / "pip-blink.png", optimize=True)
    body.save(OUT / "pip-body.png", optimize=True)
    foot_l.save(OUT / "pip-foot-l.png", optimize=True)
    foot_r.save(OUT / "pip-foot-r.png", optimize=True)

    # Reassemble to prove nothing was lost: the union of the layers has to be
    # the original silhouette exactly.
    src = np.array(idle).astype(int)
    rebuilt = np.zeros_like(src)
    for part in (body, foot_l, foot_r):
        rebuilt[:, :, 3] = np.maximum(rebuilt[:, :, 3], np.array(part).astype(int)[:, :, 3])
    drift = int(np.abs(rebuilt[:, :, 3] - src[:, :, 3]).max())

    print(f"canvas {CANVAS}  char height {CHAR_H}  baseline {BASELINE}  ankle {ANKLE_Y}")
    for name, im in (("body", body), ("foot-l", foot_l), ("foot-r", foot_r), ("blink", blink)):
        x0, y0, x1, y1 = bbox(im)
        print(f"  {name:7s} bbox {x0},{y0} .. {x1},{y1}   size {x1 - x0 + 1}x{y1 - y0 + 1}")
    print(f"  reassembly alpha drift: {drift}")

    for name, im in (("foot-l", foot_l), ("foot-r", foot_r)):
        x0, y0, x1, y1 = bbox(im)
        # Transform origin as a percentage of the canvas: the ankle, not the
        # top of the leg stub, so the foot pivots where a foot actually pivots.
        ox = (x0 + x1) / 2 / CANVAS * 100
        oy = ANKLE_Y / CANVAS * 100
        print(f"  {name} origin {ox:.2f}% {oy:.2f}%  (transform-origin)")


if __name__ == "__main__":
    main()
