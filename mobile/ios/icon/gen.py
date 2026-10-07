# The app icon: growth rings. Writes the concept SVGs and final-{default,dark,tinted}.svg;
# render them to 1024px PNGs in a browser, and strip the alpha channel from the default.
import math, random
GROUND = '''<defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#123222"/><stop offset="1" stop-color="#08160d"/></radialGradient>
<pattern id="hatch" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="34" height="34" fill="#163626"/><rect width="13" height="34" fill="#3fa874"/></pattern></defs>
<rect width="1024" height="1024" fill="url(#g)"/>'''
INK="#f3efe6"; ACC="#3fa874"; ACC2="#2d8a5e"; DIM="#1d3a29"

def blob(cx, cy, r, seed, amp=0.06, n=180):
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    pts = []
    for i in range(n):
        a = 2*math.pi*i/n
        k = 1 + amp*(math.sin(2*a+ph[0])*0.6 + math.sin(3*a+ph[1])*0.3 + math.sin(5*a+ph[2])*0.12)
        pts.append((cx + r*k*math.cos(a), cy + r*k*math.sin(a)))
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z"

def rings():
    # Growth rings drifting off-centre like contours; one ring read in the reserved ink.
    out = [GROUND]
    out.append(f'<path d="{blob(560, 478, 30, 7, 0.05)}" fill="{ACC}"/>')
    for i, r in enumerate([92, 152, 236, 286, 352]):
        cx, cy = 556 - i*11, 482 + i*7
        col = INK if i == 2 else ACC
        op = 1 if i == 2 else 0.92 - i*0.13
        out.append(f'<path d="{blob(cx, cy, r, 7, 0.045 + i*0.012)}" fill="none" stroke="{col}" stroke-opacity="{op:.2f}" stroke-width="{30 if i == 2 else 26}" stroke-linejoin="round"/>')
    return "".join(out)

def lineage():
    # One life in the middle: two parents above, two children below, the same branching mirrored.
    out = [GROUND]
    s = 'fill="none" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"'
    out.append(f'<path d="M512 512 V392 M512 392 H352 V286 M512 392 H672 V286" stroke="{ACC}" {s}/>')
    out.append(f'<path d="M512 512 V632 M512 632 H352 V738 M512 632 H672 V738" stroke="{ACC}" stroke-opacity="0.55" {s}/>')
    for x, y, o in [(352, 238, 1), (672, 238, 1), (352, 786, .55), (672, 786, .55)]:
        out.append(f'<circle cx="{x}" cy="{y}" r="56" fill="none" stroke="{ACC}" stroke-opacity="{o}" stroke-width="40"/>')
    out.append(f'<circle cx="512" cy="512" r="74" fill="{INK}"/>')
    return "".join(out)

def stripes():
    # Three generations as bands; one hatched year span; the reading column crossing them all.
    out = [GROUND]
    for x0, y, x1 in [(150, 262, 720), (262, 452, 874), (398, 642, 874)]:
        out.append(f'<rect x="{x0}" y="{y}" width="{x1-x0}" height="132" rx="30" fill="#24493a"/>')
    out.append(f'<rect x="330" y="262" width="140" height="132" fill="{ACC}"/>')
    out.append(f'<rect x="640" y="452" width="170" height="132" fill="url(#hatch)"/>')
    out.append(f'<rect x="540" y="182" width="64" height="676" rx="32" fill="none" stroke="{INK}" stroke-width="22"/>')
    return "".join(out)

def canopy():
    # The current mark redrawn as a contour map: the canopy is a hill, the trunk one line.
    out = [GROUND]
    for i, r in enumerate([300, 228, 158, 92]):
        cy = 430 - i*26
        cx = 512 + i*10
        out.append(f'<path d="{blob(cx, cy, r, 3, 0.035)}" fill="{ACC2 if i==0 else "none"}" fill-opacity="0.22" stroke="{INK if i==3 else ACC}" stroke-opacity="{1 if i==3 else 0.9-i*0.12:.2f}" stroke-width="30" stroke-linejoin="round"/>')
    out.append(f'<path d="M512 730 V880" stroke="{ACC}" stroke-width="44" stroke-linecap="round"/>')
    return "".join(out)

concepts = [("rings", "Growth rings", "A cross-section of the tree: years laid down ring by ring, drifting off-centre like the contour drawings. One ring is read in the reserved ink, the way the timeline reads one year.", rings()),
            ("lineage", "One life between", "A person in the middle: parents above, children below, the same branching carried down and fading. The family tree in its plainest form.", lineage()),
            ("stripes", "Family stripes", "Three generations as bands, a trauma year filled, an approximate span hatched, and the reading column crossing them all. The timeline as a mark.", stripes()),
            ("canopy", "Contour canopy", "The current tree kept, redrawn as a contour map: the canopy becomes a hill with a summit read in the reserved ink. Recognisable, but finally in the app's own language.", canopy())]
import json
for key, *_ , svg in concepts:
    open(f"{key}.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{svg}</svg>')
json.dump([{"key": k, "name": n, "note": d} for k, n, d, _ in concepts], open("concepts.json", "w"))
print("ok")

def rings_variant(ground=True, tinted=False):
    out = [GROUND if ground else ""]
    acc = "#ffffff" if tinted else ACC
    ink = "#ffffff" if tinted else INK
    out.append(f'<path d="{blob(560, 478, 30, 7, 0.05)}" fill="{acc}" fill-opacity="{0.75 if tinted else 1}"/>')
    for i, r in enumerate([92, 152, 236, 286, 352]):
        cx, cy = 556 - i*11, 482 + i*7
        col = ink if i == 2 else acc
        op = 1 if i == 2 else (0.62 - i*0.09 if tinted else 0.92 - i*0.13)
        out.append(f'<path d="{blob(cx, cy, r, 7, 0.045 + i*0.012)}" fill="none" stroke="{col}" stroke-opacity="{op:.2f}" stroke-width="{30 if i == 2 else 26}" stroke-linejoin="round"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{"".join(out)}</svg>'

open("final-default.svg", "w").write(rings_variant())
open("final-dark.svg", "w").write(rings_variant(ground=False))
open("final-tinted.svg", "w").write(rings_variant(ground=False, tinted=True))
