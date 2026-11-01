"""Thêm 8 tranh chủ đề sáp màu cho CareNest, dùng lại nét vẽ của build_crayon_scenes.py."""
import math
import sys
from pathlib import Path

REPO_ILLU = Path(__file__).parent
sys.path.insert(0, str(REPO_ILLU))
import build_crayon_scenes as b  # noqa: E402

# Màu bổ sung cho chủ đề mới (đăng ký trước khi defs() sinh pattern)
for name, col, out in [
    ("red", "#E5484D", "#B8282D"),
    ("navy", "#3B4A8C", "#26306A"),
    ("purple", "#9B8CE0", "#6C5BC4"),
    ("cream", "#FFE3A6", "#E0B860"),
    ("sand", "#F3D49B", "#C9A45E"),
    ("leaf", "#E8892E", "#B9611A"),
]:
    b.COLORS[name] = col
    b.OUTLINE[name] = out

fill, circle_d, line, kid, sun, cloud = b.fill, b.circle_d, b.line, b.kid, b.sun, b.cloud
tree, butterfly, flower, balloon, grass_band, page, INK = b.tree, b.butterfly, b.flower, b.balloon, b.grass_band, b.page, b.INK
W, H = 1600, 900
HERE = Path(__file__).parent


def sky(col="skyl", op=0.6):
    return (f'<path d="M-40 -40 H{W + 40} V300 C1300 340 1060 280 820 320 C560 360 300 290 -40 330 Z" fill="url(#h-{col})" opacity="{op}"/>'
            f'<path d="M-40 260 C240 330 520 250 820 300 C1100 350 1340 270 {W + 40} 320 V760 H-40 Z" fill="url(#h-{col})" opacity="{op * 0.25}"/>')


def ground(col="mint", top=740):
    d = f"M-40 {top} C{W * 0.2} {top - 40} {W * 0.4} {top + 20} {W * 0.6} {top - 10} S{W * 0.9} {top - 30} {W + 40} {top} V{H + 40} H-40 Z"
    return fill(d, col, w=5)


def star(cx, cy, r, col="yellow"):
    pts = " ".join(f"{cx + math.cos(-math.pi / 2 + i * math.pi / 5) * (r if i % 2 == 0 else r * 0.45):.1f},{cy + math.sin(-math.pi / 2 + i * math.pi / 5) * (r if i % 2 == 0 else r * 0.45):.1f}" for i in range(10))
    return fill(f"M{pts} Z", col, cross=False, w=3)


def carrot(x, y, s=1.0):
    body = f"M{x - 14 * s} {y} Q{x} {y + 70 * s} {x + 2 * s} {y + 74 * s} Q{x + 6 * s} {y + 70 * s} {x + 14 * s} {y} Z"
    leaves = "".join(line(x, y, x + dx * s, y - 30 * s, b.OUTLINE["green"], 5 * s) for dx in (-12, 0, 12))
    return leaves + fill(body, "orange", w=4 * s)


def cabbage(x, y, s=1.0):
    return fill(circle_d(x, y, 34 * s), "green", w=4 * s) + fill(circle_d(x, y + 4 * s, 20 * s), "mint", cross=False, w=3 * s)


def sunflower(x, y, s=1.0):
    petals = "".join(fill(circle_d(x + math.cos(a) * 26 * s, y + math.sin(a) * 26 * s, 13 * s), "yellow", cross=False, w=3 * s) for a in [i * math.pi / 5 for i in range(10)])
    return line(x, y + 20 * s, x, y + 160 * s, b.OUTLINE["green"], 7 * s) + petals + fill(circle_d(x, y, 18 * s), "brown", w=3 * s)


def watering_can(x, y, s=1.0):
    body = f"M{x} {y} h{70 * s} v{50 * s} h{-70 * s} Z"
    spout = f"M{x + 70 * s} {y + 10 * s} l{40 * s} {-30 * s} l{8 * s} {8 * s} l{-38 * s} {34 * s} Z"
    drops = "".join(f'<path d="M{x + 120 * s + i * 14 * s} {y - 6 * s + i * 18 * s} q4 8 0 12 q-4 -4 0 -12" fill="{b.COLORS["sky"]}"/>' for i in range(3))
    return fill(body, "sky", w=4 * s) + fill(spout, "sky", w=4 * s) + drops


def fence(x0, x1, y, h=70):
    out = [line(x0, y + 18, x1, y + 18, b.OUTLINE["brown"], 6), line(x0, y + 48, x1, y + 48, b.OUTLINE["brown"], 6)]
    for x in range(int(x0), int(x1), 46):
        out.append(fill(f"M{x} {y + h} V{y} l12 -14 l12 14 V{y + h} Z", "cream", w=4))
    return "".join(out)


def basket(x, y, s=1.0):
    body = f"M{x - 60 * s} {y} h{120 * s} l{-14 * s} {60 * s} h{-92 * s} Z"
    handle = f'<path d="M{x - 50 * s} {y} Q{x} {y - 80 * s} {x + 50 * s} {y}" fill="none" stroke="{b.OUTLINE["brown"]}" stroke-width="{7 * s}"/>'
    fruits = fill(circle_d(x - 28 * s, y - 8 * s, 18 * s), "red", w=3 * s) + fill(circle_d(x + 4 * s, y - 14 * s, 18 * s), "yellow", w=3 * s) + fill(circle_d(x + 32 * s, y - 6 * s, 16 * s), "orange", w=3 * s)
    return handle + fruits + fill(body, "brown", w=4 * s)


def blanket(x, y, w, h):
    out = [fill(f"M{x} {y} L{x + w} {y} L{x + w + 60} {y + h} L{x - 60} {y + h} Z", "white", cross=False, w=4)]
    for i in range(1, 6):
        t = i / 6
        out.append(line(x + w * t - 60 * (1 - t) + 60 * t - 60 * t, y, x + (w + 120) * t - 60, y + h, b.COLORS["red"], 6))
    for i in range(1, 3):
        yy = y + h * i / 3
        out.append(line(x - 60 * i / 3, yy, x + w + 60 * i / 3, yy, b.COLORS["red"], 6))
    return "".join(out)


def bowl(x, y, s=1.0, col="sky"):
    return fill(f"M{x - 34 * s} {y} h{68 * s} q{-6 * s} {36 * s} {-34 * s} {36 * s} q{-28 * s} 0 {-34 * s} {-36 * s} Z", col, w=4 * s) + fill(circle_d(x, y - 4 * s, 22 * s), "cream", cross=False, w=2 * s)


def wave_band(top, col, amp=18, op=1.0):
    seg = "".join(f" q50 {-amp} 100 0 q50 {amp} 100 0" for _ in range(9))
    d = f"M-60 {top}{seg} V{H + 40} H-60 Z"
    return f'<g opacity="{op}">' + fill(d, col, w=5) + "</g>"


def sailboat(x, y, s=1.0):
    hull = f"M{x - 70 * s} {y} h{140 * s} l{-26 * s} {36 * s} h{-88 * s} Z"
    sail = f"M{x} {y - 10 * s} V{y - 140 * s} L{x + 70 * s} {y - 20 * s} Z"
    sail2 = f"M{x - 6 * s} {y - 20 * s} V{y - 110 * s} L{x - 56 * s} {y - 20 * s} Z"
    return fill(sail, "white", cross=False, w=4 * s) + fill(sail2, "yellow", w=4 * s) + fill(hull, "red", w=4 * s)


def sandcastle(x, y, s=1.0):
    out = [fill(f"M{x - 80 * s} {y} V{y - 60 * s} h{160 * s} V{y} Z", "sand", w=4 * s)]
    for dx in (-80, -10, 50):
        out.append(fill(f"M{x + dx * s} {y - 60 * s} V{y - 110 * s} h{30 * s} V{y - 60 * s} Z", "sand", w=4 * s))
        out.append(fill(f"M{x + dx * s} {y - 110 * s} l{15 * s} {-26 * s} l{15 * s} {26 * s} Z", "red", cross=False, w=3 * s))
    return "".join(out)


def bucket(x, y, s=1.0):
    return fill(f"M{x - 30 * s} {y - 50 * s} h{60 * s} l{-8 * s} {50 * s} h{-44 * s} Z", "pink", w=4 * s) + f'<path d="M{x - 30 * s} {y - 50 * s} Q{x} {y - 90 * s} {x + 30 * s} {y - 50 * s}" fill="none" stroke="{INK}" stroke-width="3"/>'


def gull(x, y, s=1.0):
    return f'<path d="M{x - 22 * s} {y} q{11 * s} {-14 * s} {22 * s} 0 q{11 * s} {-14 * s} {22 * s} 0" fill="none" stroke="{INK}" stroke-width="{4 * s}" stroke-linecap="round"/>'


def moon(cx, cy, r):
    d = f"M{cx} {cy - r} A{r} {r} 0 1 0 {cx} {cy + r} A{r * 0.72} {r} 0 1 1 {cx} {cy - r} Z"
    return fill(d, "yellow", w=5) + b.face(cx - r * 0.55, cy + 4, r / 46)


def house(x, y, s=1.0, wall="cream", roof="red", lit=True):
    out = [fill(f"M{x} {y} h{160 * s} v{120 * s} h{-160 * s} Z", wall, w=4 * s),
           fill(f"M{x - 20 * s} {y} L{x + 80 * s} {y - 80 * s} L{x + 180 * s} {y} Z", roof, w=4 * s),
           fill(f"M{x + 60 * s} {y + 120 * s} v{-60 * s} h{40 * s} v{60 * s} Z", "brown", w=3 * s)]
    win = "yellow" if lit else "skyl"
    out.append(fill(f"M{x + 18 * s} {y + 24 * s} h{32 * s} v{32 * s} h{-32 * s} Z", win, w=3 * s))
    out.append(fill(f"M{x + 110 * s} {y + 24 * s} h{32 * s} v{32 * s} h{-32 * s} Z", win, w=3 * s))
    return "".join(out)


def autumn_tree(x, y, s=1.0, col="leaf"):
    return tree(x, y, s, col)


def falling_leaf(x, y, rot, col="leaf", s=1.0):
    return f'<g transform="rotate({rot} {x} {y})">' + fill(f"M{x} {y - 14 * s} Q{x + 14 * s} {y} {x} {y + 14 * s} Q{x - 14 * s} {y} {x} {y - 14 * s} Z", col, cross=False, w=2.5) + "</g>"


def kite(x, y, col="red", s=1.0):
    return (fill(f"M{x} {y - 50 * s} L{x + 40 * s} {y} L{x} {y + 50 * s} L{x - 40 * s} {y} Z", col, w=4 * s)
            + f'<path d="M{x} {y + 50 * s} q{14 * s} {18 * s} 0 {32 * s} q{-14 * s} {14 * s} 0 {30 * s}" fill="none" stroke="{b.COLORS["blue"]}" stroke-width="6" stroke-linecap="round"/>')


def blossom_branch(x0, y0, x1, y1, col="yellow", n=9, s=1.0):
    out = [f'<path d="M{x0} {y0} Q{(x0 + x1) / 2} {y0 - 60} {x1} {y1}" fill="none" stroke="{b.OUTLINE["brown"]}" stroke-width="{9 * s}" stroke-linecap="round"/>']
    for i in range(n):
        t = (i + 0.5) / n
        bx = x0 + (x1 - x0) * t
        by = y0 + (y1 - y0) * t - 60 * 4 * t * (1 - t) + (18 if i % 2 else -18)
        petals = "".join(fill(circle_d(bx + math.cos(a) * 11 * s, by + math.sin(a) * 11 * s, 9 * s), col, cross=False, w=2.5) for a in [k * 2 * math.pi / 5 for k in range(5)])
        out.append(petals + f'<circle cx="{bx}" cy="{by}" r="{5 * s}" fill="{b.COLORS["orange"]}"/>')
    return "".join(out)


def lantern(x, y, s=1.0):
    return (line(x, y - 70 * s, x, y - 34 * s, INK, 3)
            + fill(f"M{x - 34 * s} {y} Q{x} {y - 50 * s} {x + 34 * s} {y} Q{x} {y + 50 * s} {x - 34 * s} {y} Z", "red", w=4 * s)
            + fill(f"M{x - 14 * s} {y - 32 * s} h{28 * s} v{-8 * s} h{-28 * s} Z", "yellow", cross=False, w=2)
            + line(x, y + 36 * s, x, y + 64 * s, b.COLORS["yellow"], 5))


def banh_chung(x, y, s=1.0):
    return (fill(f"M{x} {y} h{90 * s} v{90 * s} h{-90 * s} Z", "green", w=4 * s)
            + line(x + 45 * s, y, x + 45 * s, y + 90 * s, b.COLORS["cream"], 6) + line(x, y + 45 * s, x + 90 * s, y + 45 * s, b.COLORS["cream"], 6))


def block(x, y, letter, col, s=1.0):
    return fill(f"M{x} {y} h{70 * s} v{70 * s} h{-70 * s} Z", col, w=4 * s) + f'<text x="{x + 35 * s}" y="{y + 50 * s}" font-family="Comic Sans MS, Nunito, sans-serif" font-size="{44 * s}" font-weight="700" text-anchor="middle" fill="{INK}">{letter}</text>'


def books(x, y, s=1.0):
    out = []
    for i, (col, w) in enumerate([("blue", 150), ("pink", 130), ("yellow", 160), ("mint", 140)]):
        yy = y - i * 30 * s
        out.append(fill(f"M{x + (i % 2) * 10 * s} {yy} h{w * s} v{-28 * s} h{-w * s} Z", col, w=4 * s))
    return "".join(out)


def easel(x, y, s=1.0):
    legs = line(x - 70 * s, y + 220 * s, x, y - 20 * s, b.OUTLINE["brown"], 7) + line(x + 70 * s, y + 220 * s, x, y - 20 * s, b.OUTLINE["brown"], 7)
    board = fill(f"M{x - 90 * s} {y} h{180 * s} v{140 * s} h{-180 * s} Z", "white", cross=False, w=5 * s)
    art = sun(x - 40 * s, y + 40 * s, 16) + f'<path d="M{x - 80 * s} {y + 120 * s} Q{x} {y + 70 * s} {x + 80 * s} {y + 120 * s}" fill="none" stroke="{b.COLORS["green"]}" stroke-width="8"/>' + fill(f"M{x + 20 * s} {y + 110 * s} v{-40 * s} l{20 * s} {-20 * s} l{20 * s} {20 * s} v{40 * s} Z", "pink", w=3)
    return legs + board + art


def crayon(x, y, col, rot=0, s=1.0):
    return f'<g transform="rotate({rot} {x} {y})">' + fill(f"M{x} {y} h{90 * s} v{20 * s} h{-90 * s} Z", col, w=3 * s) + fill(f"M{x + 90 * s} {y} l{24 * s} {10 * s} l{-24 * s} {10 * s} Z", col, cross=False, w=3 * s) + "</g>"


def ruler_wall(x, y, h=330):
    out = [fill(f"M{x} {y} h46 v{-h} h-46 Z", "yellow", w=4)]
    for i in range(0, h, 30):
        out.append(line(x, y - i, x + (24 if i % 60 == 0 else 14), y - i, b.OUTLINE["yellow"], 3))
    return "".join(out)


def heart(x, y, s=1.0, col="pink"):
    return fill(f"M{x} {y + 30 * s} C{x - 50 * s} {y - 5 * s} {x - 30 * s} {y - 40 * s} {x} {y - 18 * s} C{x + 30 * s} {y - 40 * s} {x + 50 * s} {y - 5 * s} {x} {y + 30 * s} Z", col, w=4 * s)


def apple(x, y, s=1.0):
    return fill(circle_d(x, y, 28 * s), "red", w=4 * s) + line(x, y - 28 * s, x + 4 * s, y - 44 * s, b.OUTLINE["brown"], 5) + fill(f"M{x + 4 * s} {y - 38 * s} q{18 * s} {-12 * s} {26 * s} 0 q{-14 * s} {8 * s} {-26 * s} 0 Z", "green", cross=False, w=2)


def toothbrush(x, y, s=1.0):
    return (f'<g transform="rotate(-30 {x} {y})">' + fill(f"M{x} {y} h{120 * s} v{14 * s} h{-120 * s} Z", "sky", w=3 * s)
            + fill(f"M{x + 92 * s} {y} v{-26 * s} h{28 * s} v{26 * s} Z", "white", cross=False, w=3 * s) + "</g>")


def flowers_row(y):
    return "".join(flower(x, y + (i % 3) * 14, c, 0.9) for i, (x, c) in enumerate(zip(range(80, W, 190), ["pink", "yellow", "sky", "pink", "yellow", "sky", "pink", "yellow", "sky"])))


# ---------- 8 chủ đề ----------
def vuon_rau():
    p = [sky(), sun(1380, 170, 52), cloud(300, 140, 1.0), cloud(900, 110, 0.8), ground("mint", 600)]
    p.append(fence(-20, W + 20, 520))
    for x in range(140, 760, 120):
        p.append(carrot(x, 680, 1.0))
    for x in range(900, 1500, 150):
        p.append(cabbage(x, 720, 1.1))
    p += [sunflower(1520, 470, 1.2), sunflower(60, 500, 1.0), kid(540, 520, 1.1, "sky", arms="hold"), watering_can(590, 540, 1.0),
          kid(1150, 520, 1.1, "pink", "hair2", arms="wave", girl=True), butterfly(780, 400, 1.0, "pink"), butterfly(1250, 380, 0.9, "yellow")]
    return page("".join(p), W, H, "Vườn rau của bé")


def bua_an():
    p = [sky(), sun(220, 160, 44), cloud(700, 120, 0.9), cloud(1250, 150, 1.0), ground("mint", 620), tree(1460, 640, 1.2), tree(140, 640, 1.0, "mint")]
    p.append(blanket(520, 650, 560, 170))
    p += [basket(800, 690, 1.0), bowl(640, 760, 0.9, "sky"), bowl(960, 760, 0.9, "pink"), apple(1060, 720, 0.8),
          kid(430, 660, 1.0, "orange", legs="sit", arms="wave"), kid(1190, 660, 1.0, "mint", "hair2", legs="sit", arms="hold", girl=True),
          butterfly(1000, 450, 0.9, "sky"), balloon(300, 500, "pink", 0.8)]
    return page("".join(p), W, H, "Bữa trưa dã ngoại")


def bien():
    p = [sky("skyl", 0.5), sun(1300, 170, 56), cloud(260, 130, 1.0), cloud(820, 90, 0.8), gull(600, 200), gull(680, 240, 0.8), gull(1000, 180, 0.9)]
    p += [wave_band(470, "sky", 16), wave_band(540, "skyl", 14, 0.9), sailboat(1150, 480, 0.9)]
    p.append(fill(f"M-40 620 C400 590 800 640 1200 600 S1500 610 {W + 40} 600 V{H + 40} H-40 Z", "sand", w=5))
    p += [sandcastle(420, 800, 1.0), bucket(640, 820, 1.0), kid(820, 620, 1.1, "yellow", arms="up"), kid(1000, 640, 1.05, "pink", "hair2", arms="wave", girl=True)]
    p += [star(1350, 800, 26, "orange"), star(220, 840, 20, "pink")]
    return page("".join(p), W, H, "Một ngày ở biển")


def dem_sao():
    p = [f'<path d="M-40 -40 H{W + 40} V700 H-40 Z" fill="url(#h-navy)" opacity="0.35"/>', moon(1300, 200, 70)]
    for i, (x, y) in enumerate([(160, 120), (360, 260), (560, 90), (760, 220), (980, 120), (1100, 330), (1500, 380), (260, 420), (680, 400)]):
        p.append(star(x, y, 18 + (i % 3) * 6, "yellow"))
    p += [ground("purple", 660), house(260, 560, 1.2, lit=True), house(1080, 580, 1.0, "skyl", "navy", True),
          tree(760, 650, 1.0, "green"), kid(620, 580, 1.0, "purple", arms="wave")]
    return page("".join(p), W, H, "Đêm sao yên bình")


def mua_thu():
    p = [sky("cream", 0.5), sun(260, 170, 46), cloud(800, 120, 0.9), ground("leaf", 690)]
    p += [autumn_tree(200, 680, 1.3, "leaf"), autumn_tree(1400, 680, 1.4, "yellow"), autumn_tree(900, 690, 1.0, "red")]
    for i in range(16):
        p.append(falling_leaf(120 + i * 95, 300 + (i * 53) % 320, i * 37, ["leaf", "yellow", "red"][i % 3], 1.0))
    p += [f'<path d="M700 330 C 660 450, 640 560, 610 650" fill="none" stroke="{INK}" stroke-width="2.5" stroke-opacity="0.6"/>', kite(700, 300, "red"),
          kid(600, 570, 1.1, "sky", arms="up"), kid(1150, 580, 1.05, "pink", "hair2", arms="wave", girl=True)]
    return page("".join(p), W, H, "Mùa thu lá vàng")


def tet():
    p = [sky("cream", 0.45), blossom_branch(-20, 140, 640, 60, "yellow", 11), blossom_branch(1620, 150, 980, 70, "pink", 11)]
    p += [lantern(760, 230, 1.0), lantern(880, 270, 0.9), lantern(1000, 230, 1.0), ground("mint", 690)]
    p += [banh_chung(300, 680, 1.0), banh_chung(400, 700, 0.8), kid(620, 570, 1.1, "red", arms="wave"), kid(820, 570, 1.1, "yellow", "hair2", arms="hold", girl=True),
          kid(1020, 570, 1.1, "pink", arms="up"), basket(1300, 740, 1.0)]
    for x, y in [(520, 420), (1150, 400), (1450, 480)]:
        p.append(star(x, y, 18, "yellow"))
    return page("".join(p), W, H, "Tết vui xuân")


def lop_hoc():
    p = [f'<path d="M-40 -40 H{W + 40} V640 H-40 Z" fill="url(#h-cream)" opacity="0.4"/>']
    p.append(b.bunting(-20, 30, 1640, 40, 70, 16, 34))
    p.append(fill("M-40 640 H1640 V940 H-40 Z", "sand", w=5))
    p += [easel(1250, 360, 1.1), books(120, 700, 1.0), block(480, 600, "A", "red"), block(560, 600, "B", "sky"), block(520, 530, "C", "yellow"),
          crayon(700, 760, "red", -12), crayon(720, 800, "blue", 8), crayon(760, 840, "green", -4), kid(880, 520, 1.15, "mint", arms="up"), kid(1060, 540, 1.1, "pink", "hair2", arms="hold", girl=True)]
    p += [star(300, 220, 26, "yellow"), star(700, 260, 20, "pink"), heart(1500, 250, 0.9)]
    return page("".join(p), W, H, "Góc học tập")


def suc_khoe():
    p = [sky(), sun(1380, 160, 46), cloud(420, 130, 0.9), ground("mint", 690)]
    p += [ruler_wall(560, 690, 340), kid(650, 580, 1.0, "sky", arms="up"), heart(860, 360, 1.3, "pink"), heart(1000, 300, 0.8, "red"),
          apple(1150, 640, 1.0), apple(1230, 660, 0.8), toothbrush(300, 640, 1.2), kid(1000, 570, 1.1, "yellow", "hair2", arms="wave", girl=True)]
    p += [flowers_row(830)]
    return page("".join(p), W, H, "Bé khỏe mỗi ngày")


SCENES = {"vuon-rau": vuon_rau, "bua-an": bua_an, "bien": bien, "dem-sao": dem_sao, "mua-thu": mua_thu, "tet": tet, "lop-hoc": lop_hoc, "suc-khoe": suc_khoe}

if __name__ == "__main__":
    for key, fn in SCENES.items():
        (HERE / f"{key}.html").write_text(fn(), encoding="utf-8")
    print("ok", len(SCENES))
