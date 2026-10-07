# The app icon: growth rings around a heart beyond the corner. Writes the round-two
# concepts and final-{default,dark,tinted}.svg; render those to 1024px PNGs in a
# browser and strip the alpha channel from the default (App Store requirement).
# Growth rings, second round: many thin rings around an off-centre heart,
# rounder organic outlines, and no single bold ring (that read as an eye).
import math, random

INK = "#f3efe6"; ACC = "#3fa874"; DEEP = "#2d8a5e"
GROUND = '''<defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#123222"/><stop offset="1" stop-color="#08160d"/></radialGradient></defs>
<rect width="1024" height="1024" fill="url(#g)"/>'''

def outline(cx, cy, r, harmonics, n=240):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + sum(amp * math.sin(h * a + ph) for h, amp, ph in harmonics)
        pts.append((cx + r * k * math.cos(a), cy + r * k * math.sin(a)))
    # Smooth closed path through the points (Catmull-Rom to cubic Bezier).
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    return d + "Z"

def ring_set(seed, heart, lean, count, r0, r1, wobble):
    """Radii with uneven spacing (lean and full years); each ring grows more toward `lean`,
    so the heart sits off-centre as in a real trunk. The outline wobble grows outward."""
    rnd = random.Random(seed)
    widths = [rnd.uniform(0.6, 1.4) for _ in range(count)]
    total = sum(widths)
    base = [(h, 0, rnd.uniform(0, 6.28)) for h in (2, 3, 4, 5, 7)]
    rings, acc = [], 0
    for i, w in enumerate(widths):
        acc += w
        r = r0 + (r1 - r0) * acc / total
        t = acc / total
        harm = [(h, wobble * t / h ** 1.3 * (1 + 0.15 * rnd.uniform(-1, 1)), ph + 0.25 * t) for h, _, ph in base]
        cx = heart[0] + lean[0] * (r - r0)
        cy = heart[1] + lean[1] * (r - r0)
        rings.append(outline(cx, cy, r, harm))
    return rings

def svg(inner, ground=True):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{GROUND if ground else ""}{inner}</svg>'

def slice_(ground=True, mono=None):
    # A: a whole slice of trunk inside the icon, bark as the outer, darker band.
    rings = ring_set(14, (448, 452), (0.1, 0.08), 8, 52, 352, 0.11)
    out = []
    for i, d in enumerate(rings):
        lit = i == 6
        out.append(f'<path d="{d}" fill="none" stroke="{mono or (INK if lit else ACC)}" stroke-opacity="{1 if lit else 0.92 - i * 0.06:.2f}" stroke-width="{15 if lit else 14}"/>')
    return svg("".join(out), ground)

def corner(ground=True, mono=None):
    # B: the heart sits beyond the lower-left edge; rings sweep across and leave the frame.
    rings = ring_set(8, (128, 930), (0.07, -0.05), 12, 70, 1060, 0.16)
    out = [f'<circle cx="128" cy="930" r="22" fill="{mono or ACC}"/>']
    for i, d in enumerate(rings):
        lit = i == 6
        out.append(f'<path d="{d}" fill="none" stroke="{mono or (INK if lit else ACC)}" stroke-opacity="{1 if lit else 0.95 - i * 0.05:.2f}" stroke-width="{20 if lit else 15}"/>')
    return svg(f'<g>{"".join(out)}</g>', ground)

def canopy(ground=True, mono=None):
    # C: the rings drawn as a crown on a trunk: the tree and its years in one mark.
    rings = ring_set(23, (500, 420), (0.06, -0.12), 8, 20, 262, 0.08)
    out = [f'<path d="M512 690 C512 760 506 820 512 880" fill="none" stroke="{mono or DEEP}" stroke-width="40" stroke-linecap="round"/>']
    for i, d in enumerate(rings):
        lit = i == 4
        out.append(f'<path d="{d}" fill="none" stroke="{mono or (INK if lit else ACC)}" stroke-opacity="{1 if lit else 0.9 - i * 0.05:.2f}" stroke-width="{18 if lit else 14}"/>')
    return svg("".join(out), ground)

if __name__ == "__main__":
    for key, f in (("slice", slice_), ("corner", corner), ("canopy2", canopy)):
        open(f"{key}.svg", "w").write(f())
    print("ok")

def write_finals():
    open("final-default.svg", "w").write(corner())
    open("final-dark.svg", "w").write(corner(ground=False))
    open("final-tinted.svg", "w").write(corner(ground=False, mono="#ffffff"))

write_finals()
