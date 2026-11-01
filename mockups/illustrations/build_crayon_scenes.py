"""Sinh tranh nền phong cách SÁP MÀU (crayon) cho CareNest.

Kỹ thuật: tô vùng bằng nét gạch chéo (pattern) để lộ giấy, nét viền dày; một filter "sáp" áp cho cả nhóm
(hạt sáp lốm đốm + rung nhẹ) để render nhanh. Màu chủ đạo theo repo: primary #1565E0, xanh trời #4FB0F5/#71C6FD,
mint #94DEBD; điểm vàng/cam/hồng nhỏ cho vui mắt.

Chạy:  python mockups/illustrations/build_crayon_scenes.py
Rồi:   node mockups/illustrations/render.mjs mockups/illustrations/login-scene.html out.png 1600 900 2
"""
import math
from pathlib import Path

HERE = Path(__file__).parent

COLORS = {
    "blue": "#1565E0",
    "sky": "#4FB0F5",
    "skyl": "#71C6FD",
    "mint": "#94DEBD",
    "green": "#4FBF8B",
    "yellow": "#FFCC33",
    "orange": "#FF9F43",
    "pink": "#F78FB3",
    "brown": "#B07A4A",
    "skin": "#F6C9A0",
    "hair": "#3A3A4A",
    "hair2": "#8A5A3B",
    "white": "#FFFFFF",
}
INK = "#2E3A55"  # nét viền mặt / chi tiết
OUTLINE = {"blue": "#0F55C4", "sky": "#2F8FDC", "skyl": "#4FB0F5", "mint": "#3FAF86", "green": "#2F9C6A",
           "yellow": "#E8A800", "orange": "#E07B1A", "pink": "#E0608F", "brown": "#7E5230", "skin": "#D9976A",
           "white": "#9CCBF0", "hair": "#22222E", "hair2": "#5E3B24"}


def defs():
    pats = []
    for name, col in COLORS.items():
        # mỗi màu: nền nhạt + nét gạch chéo đậm ⇒ giống tô sáp, lộ giấy
        pats.append(
            f'<pattern id="h-{name}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">'
            f'<rect width="8" height="8" fill="{col}" fill-opacity="0.32"/>'
            f'<line x1="0" y1="4" x2="8" y2="4" stroke="{col}" stroke-width="5.2"/></pattern>'
        )
        pats.append(
            f'<pattern id="x-{name}" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(52)">'
            f'<line x1="0" y1="5.5" x2="11" y2="5.5" stroke="{col}" stroke-width="3" stroke-opacity="0.55"/></pattern>'
        )
    return f"""<defs>
    {''.join(pats)}
    <filter id="wax" x="-3%" y="-3%" width="106%" height="106%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" result="n" />
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.3 1.78" result="m" />
      <feComposite in="SourceGraphic" in2="m" operator="in" result="g" />
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="6" result="w" />
      <feDisplacementMap in="g" in2="w" scale="5" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="paper">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="1" />
      <feColorMatrix type="matrix" values="0 0 0 0 0.6  0 0 0 0 0.66  0 0 0 0 0.75  0 0 0 0.07 0" />
    </filter>
  </defs>"""


def fill(d, color, cross=True, outline=True, w=4.5):
    """Vùng tô sáp: lớp gạch chéo + lớp gạch ngược (dày màu) + viền."""
    out = f'<path d="{d}" fill="url(#h-{color})"/>'
    if cross:
        out += f'<path d="{d}" fill="url(#x-{color})"/>'
    if outline:
        out += f'<path d="{d}" fill="none" stroke="{OUTLINE[color]}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"/>'
    return out


def circle_d(cx, cy, r):
    return f"M{cx - r} {cy} a{r} {r} 0 1 0 {2 * r} 0 a{r} {r} 0 1 0 {-2 * r} 0 Z"


def line(x1, y1, x2, y2, col, w=5):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="{w}" stroke-linecap="round"/>'


def face(cx, cy, s=1.0):
    return (
        f'<g fill="none" stroke="{INK}" stroke-width="{3.2 * s}" stroke-linecap="round">'
        f'<path d="M{cx - 9 * s} {cy - 1 * s} q{3 * s} {-4 * s} {6 * s} 0"/><path d="M{cx + 3 * s} {cy - 1 * s} q{3 * s} {-4 * s} {6 * s} 0"/>'
        f'<path d="M{cx - 6 * s} {cy + 8 * s} q{6 * s} {7 * s} {12 * s} 0"/></g>'
        f'<circle cx="{cx - 13 * s}" cy="{cy + 6 * s}" r="{4 * s}" fill="{COLORS["pink"]}" fill-opacity="0.55"/>'
        f'<circle cx="{cx + 13 * s}" cy="{cy + 6 * s}" r="{4 * s}" fill="{COLORS["pink"]}" fill-opacity="0.55"/>'
    )


def kid(x, y, s=1.0, shirt="blue", hair="hair", arms="up", legs="stand", girl=False):
    """Bé vẽ kiểu thiếu nhi; (x,y) = đỉnh đầu ~ tâm đầu."""
    k = s
    out = []
    # chân
    if legs == "stand":
        out.append(line(x - 9 * k, y + 70 * k, x - 11 * k, y + 104 * k, OUTLINE["skin"], 7 * k))
        out.append(line(x + 9 * k, y + 70 * k, x + 11 * k, y + 104 * k, OUTLINE["skin"], 7 * k))
    elif legs == "sit":
        out.append(line(x - 8 * k, y + 70 * k, x + 22 * k, y + 78 * k, OUTLINE["skin"], 7 * k))
        out.append(line(x + 22 * k, y + 78 * k, x + 26 * k, y + 100 * k, OUTLINE["skin"], 7 * k))
    # thân (váy nếu là bé gái)
    if girl:
        body = f"M{x - 30 * k} {y + 76 * k} L{x - 14 * k} {y + 26 * k} Q{x} {y + 20 * k} {x + 14 * k} {y + 26 * k} L{x + 30 * k} {y + 76 * k} Z"
    else:
        body = f"M{x - 22 * k} {y + 74 * k} Q{x - 24 * k} {y + 24 * k} {x} {y + 24 * k} Q{x + 24 * k} {y + 24 * k} {x + 22 * k} {y + 74 * k} Z"
    out.append(fill(body, shirt, w=4 * k))
    # tay
    if arms == "up":
        out.append(line(x - 18 * k, y + 36 * k, x - 40 * k, y + 8 * k, OUTLINE["skin"], 7 * k))
        out.append(line(x + 18 * k, y + 36 * k, x + 40 * k, y + 8 * k, OUTLINE["skin"], 7 * k))
    elif arms == "wave":
        out.append(line(x - 18 * k, y + 36 * k, x - 36 * k, y + 58 * k, OUTLINE["skin"], 7 * k))
        out.append(line(x + 18 * k, y + 36 * k, x + 42 * k, y + 4 * k, OUTLINE["skin"], 7 * k))
    elif arms == "hold":
        out.append(line(x - 18 * k, y + 36 * k, x - 30 * k, y + 2 * k, OUTLINE["skin"], 7 * k))
        out.append(line(x + 18 * k, y + 36 * k, x + 30 * k, y + 2 * k, OUTLINE["skin"], 7 * k))
    # đầu + tóc
    out.append(fill(circle_d(x, y, 24 * k), "skin", w=3.5 * k))
    if girl:
        hair_d = (f"M{x - 26 * k} {y + 4 * k} Q{x - 28 * k} {y - 30 * k} {x} {y - 28 * k} Q{x + 28 * k} {y - 30 * k} {x + 26 * k} {y + 4 * k}"
                  f" Q{x + 30 * k} {y + 26 * k} {x + 22 * k} {y + 32 * k} Q{x + 18 * k} {y - 2 * k} {x} {y - 10 * k}"
                  f" Q{x - 18 * k} {y - 2 * k} {x - 22 * k} {y + 32 * k} Q{x - 30 * k} {y + 26 * k} {x - 26 * k} {y + 4 * k} Z")
    else:
        hair_d = f"M{x - 25 * k} {y - 2 * k} Q{x - 24 * k} {y - 30 * k} {x} {y - 28 * k} Q{x + 24 * k} {y - 30 * k} {x + 25 * k} {y - 2 * k} Q{x + 12 * k} {y - 14 * k} {x} {y - 12 * k} Q{x - 12 * k} {y - 14 * k} {x - 25 * k} {y - 2 * k} Z"
    out.append(fill(hair_d, hair, w=3 * k))
    out.append(face(x, y + 2 * k, k))
    return "".join(out)


def sun(cx, cy, r):
    rays = "".join(
        line(cx + math.cos(a) * (r + 14), cy + math.sin(a) * (r + 14), cx + math.cos(a) * (r + 38), cy + math.sin(a) * (r + 38), COLORS["orange"], 8)
        for a in [i * math.pi / 6 for i in range(12)]
    )
    return rays + fill(circle_d(cx, cy, r), "yellow", w=5) + face(cx, cy + 4, r / 26)


def cloud(x, y, s=1.0):
    d = (f"M{x} {y + 50 * s} C{x - 26 * s} {y + 50 * s} {x - 26 * s} {y + 14 * s} {x + 4 * s} {y + 12 * s}"
         f" C{x + 6 * s} {y - 16 * s} {x + 46 * s} {y - 26 * s} {x + 66 * s} {y - 2 * s}"
         f" C{x + 84 * s} {y - 28 * s} {x + 132 * s} {y - 20 * s} {x + 134 * s} {y + 10 * s}"
         f" C{x + 166 * s} {y + 10 * s} {x + 170 * s} {y + 50 * s} {x + 140 * s} {y + 50 * s} Z")
    return f'<path d="{d}" fill="#FFFFFF"/>' + f'<path d="{d}" fill="none" stroke="{COLORS["skyl"]}" stroke-width="5" stroke-linejoin="round"/>'


def bunting(x0, y0, x1, y1, sag, n, flag=34):
    """Dây cờ đuôi nheo (bezier bậc 2) với n cờ xen màu."""
    cx, cy = (x0 + x1) / 2, max(y0, y1) + sag
    out = [f'<path d="M{x0} {y0} Q{cx} {cy} {x1} {y1}" fill="none" stroke="{INK}" stroke-width="3" stroke-opacity="0.7"/>']
    cols = ["blue", "yellow", "mint", "sky", "orange", "pink"]
    for i in range(n):
        t = (i + 0.5) / n
        px = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1
        py = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1
        d = f"M{px - flag / 2} {py} L{px + flag / 2} {py} L{px} {py + flag * 1.15} Z"
        out.append(fill(d, cols[i % len(cols)], w=3.5))
    return "".join(out)


def balloon(x, y, col, s=1.0):
    d = f"M{x} {y + 38 * s} C{x - 34 * s} {y + 20 * s} {x - 30 * s} {y - 36 * s} {x} {y - 36 * s} C{x + 30 * s} {y - 36 * s} {x + 34 * s} {y + 20 * s} {x} {y + 38 * s} Z"
    return (f'<path d="M{x} {y + 38 * s} q{-8 * s} {20 * s} {2 * s} {40 * s} q{8 * s} {16 * s} {-2 * s} {34 * s}" fill="none" stroke="{INK}" stroke-width="2.5" stroke-opacity="0.6"/>'
            + fill(d, col, w=4 * s)
            + f'<path d="M{x - 14 * s} {y - 14 * s} q{4 * s} {-10 * s} {12 * s} {-12 * s}" stroke="#FFFFFF" stroke-width="{5 * s}" stroke-linecap="round" fill="none"/>')


def hot_air_balloon(x, y, s=1.0):
    out = []
    env = f"M{x} {y + 120 * s} C{x - 90 * s} {y + 60 * s} {x - 86 * s} {y - 60 * s} {x} {y - 60 * s} C{x + 86 * s} {y - 60 * s} {x + 90 * s} {y + 60 * s} {x} {y + 120 * s} Z"
    left = f"M{x} {y + 120 * s} C{x - 90 * s} {y + 60 * s} {x - 86 * s} {y - 60 * s} {x} {y - 60 * s} C{x - 40 * s} {y - 40 * s} {x - 44 * s} {y + 60 * s} {x} {y + 120 * s} Z"
    right = f"M{x} {y + 120 * s} C{x + 90 * s} {y + 60 * s} {x + 86 * s} {y - 60 * s} {x} {y - 60 * s} C{x + 40 * s} {y - 40 * s} {x + 44 * s} {y + 60 * s} {x} {y + 120 * s} Z"
    out.append(fill(env, "sky", cross=False, outline=False))
    out.append(fill(left, "blue", outline=False))
    out.append(fill(right, "mint", outline=False))
    out.append(f'<path d="{env}" fill="none" stroke="{OUTLINE["blue"]}" stroke-width="{5 * s}"/>')
    out.append(line(x - 30 * s, y + 104 * s, x - 18 * s, y + 150 * s, INK, 2.5))
    out.append(line(x + 30 * s, y + 104 * s, x + 18 * s, y + 150 * s, INK, 2.5))
    out.append(fill(f"M{x - 24 * s} {y + 150 * s} H{x + 24 * s} L{x + 18 * s} {y + 184 * s} H{x - 18 * s} Z", "brown", w=4 * s))
    return "".join(out)


def tree(x, y, s=1.0, col="green"):
    canopy = (f"M{x - 60 * s} {y} C{x - 80 * s} {y - 40 * s} {x - 40 * s} {y - 90 * s} {x - 6 * s} {y - 80 * s}"
              f" C{x + 20 * s} {y - 110 * s} {x + 74 * s} {y - 80 * s} {x + 64 * s} {y - 40 * s}"
              f" C{x + 90 * s} {y - 10 * s} {x + 60 * s} {y + 30 * s} {x + 30 * s} {y + 20 * s}"
              f" C{x + 10 * s} {y + 40 * s} {x - 30 * s} {y + 40 * s} {x - 40 * s} {y + 20 * s} C{x - 70 * s} {y + 24 * s} {x - 76 * s} {y + 6 * s} {x - 60 * s} {y} Z")
    trunk = f"M{x - 10 * s} {y + 20 * s} L{x - 14 * s} {y + 110 * s} H{x + 14 * s} L{x + 10 * s} {y + 20 * s} Z"
    apples = "".join(fill(circle_d(x + dx * s, y + dy * s, 7 * s), "orange", cross=False, w=2.5) for dx, dy in [(-30, -30), (20, -50), (36, 0), (-6, 4)])
    return fill(trunk, "brown", w=4 * s) + fill(canopy, col, w=5 * s) + apples


def butterfly(x, y, s=1.0, col="pink"):
    return (fill(circle_d(x - 12 * s, y - 6 * s, 12 * s), col, cross=False, w=3)
            + fill(circle_d(x + 12 * s, y - 6 * s, 12 * s), col, cross=False, w=3)
            + fill(circle_d(x - 9 * s, y + 10 * s, 8 * s), "yellow", cross=False, w=3)
            + fill(circle_d(x + 9 * s, y + 10 * s, 8 * s), "yellow", cross=False, w=3)
            + line(x, y - 14 * s, x, y + 18 * s, INK, 4))


def flower(x, y, col, s=1.0):
    petals = "".join(fill(circle_d(x + math.cos(a) * 9 * s, y + math.sin(a) * 9 * s, 7 * s), col, cross=False, w=2.5) for a in [i * math.pi * 2 / 5 for i in range(5)])
    return line(x, y + 8 * s, x, y + 34 * s, OUTLINE["green"], 4) + petals + fill(circle_d(x, y, 6 * s), "yellow", cross=False, w=2.5)


def slide(x, y, s=1.0):
    out = []
    out.append(line(x, y, x, y + 170 * s, OUTLINE["blue"], 8))
    out.append(line(x + 40 * s, y, x + 40 * s, y + 170 * s, OUTLINE["blue"], 8))
    for i in range(1, 6):
        out.append(line(x, y + i * 28 * s, x + 40 * s, y + i * 28 * s, OUTLINE["sky"], 6))
    out.append(fill(f"M{x - 6 * s} {y - 14 * s} H{x + 50 * s} V{y + 6 * s} H{x - 6 * s} Z", "orange", w=4))
    chute = f"M{x + 40 * s} {y} C{x + 120 * s} {y + 10 * s} {x + 130 * s} {y + 150 * s} {x + 210 * s} {y + 168 * s} L{x + 206 * s} {y + 190 * s} C{x + 116 * s} {y + 170 * s} {x + 104 * s} {y + 36 * s} {x + 40 * s} {y + 28 * s} Z"
    out.append(fill(chute, "yellow", w=5))
    return "".join(out)


def swing_set(x, y, s=1.0):
    out = []
    out.append(line(x, y, x - 40 * s, y + 190 * s, OUTLINE["mint"], 9))
    out.append(line(x, y, x + 30 * s, y + 190 * s, OUTLINE["mint"], 9))
    out.append(line(x + 220 * s, y, x + 190 * s, y + 190 * s, OUTLINE["mint"], 9))
    out.append(line(x + 220 * s, y, x + 250 * s, y + 190 * s, OUTLINE["mint"], 9))
    out.append(line(x - 10 * s, y, x + 230 * s, y, OUTLINE["blue"], 10))
    out.append(line(x + 80 * s, y, x + 86 * s, y + 120 * s, INK, 3))
    out.append(line(x + 140 * s, y, x + 134 * s, y + 120 * s, INK, 3))
    out.append(fill(f"M{x + 74 * s} {y + 118 * s} H{x + 146 * s} V{y + 132 * s} H{x + 74 * s} Z", "blue", w=4))
    return "".join(out)


def seesaw(x, y, s=1.0):
    pivot = fill(f"M{x - 26 * s} {y + 44 * s} L{x} {y} L{x + 26 * s} {y + 44 * s} Z", "yellow", w=4)
    plank = fill(f"M{x - 160 * s} {y + 18 * s} L{x + 160 * s} {y - 30 * s} L{x + 162 * s} {y - 16 * s} L{x - 158 * s} {y + 32 * s} Z", "orange", w=4)
    return pivot + plank


def grass_band(width, top, height):
    d = f"M-40 {top} C{width * 0.2} {top - 40} {width * 0.4} {top + 20} {width * 0.6} {top - 10} S{width * 0.9} {top - 30} {width + 40} {top} V{top + height} H-40 Z"
    tufts = "".join(
        f'<path d="M{x} {top + 30 + (i % 4) * 22} l6 -18 l6 18 l6 -14" fill="none" stroke="{OUTLINE["green"]}" stroke-width="4" stroke-linecap="round"/>'
        for i, x in enumerate(range(40, int(width), 95))
    )
    return fill(d, "mint", w=5) + tufts


def page(svg_inner, w, h, title, paper=True):
    bg = f'<rect width="{w}" height="{h}" fill="#FCFDFF"/>' if paper else ""
    grain = ""  # vân giấy toàn tranh làm Chrome treo khi render lớn; hạt sáp của #wax đã đủ
    return f"""<!doctype html>
<!-- {title} — sinh tự động bởi build_crayon_scenes.py, sửa ở script rồi chạy lại. -->
<html><head><meta charset="utf-8" />
<style>html,body{{margin:0;background:transparent}}svg{{display:block}}</style></head>
<body><svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">
{defs()}
{bg}
<g filter="url(#wax)">{svg_inner}</g>
{grain}
</svg></body></html>
"""


def login_scene():
    W, H = 1600, 900
    parts = []
    # trời: vài mảng tô sáp xanh trời (không phủ kín ⇒ lộ giấy như trẻ tô)
    parts.append(f'<path d="M-40 -40 H{W + 40} V300 C1300 340 1060 280 820 320 C560 360 300 290 -40 330 Z" fill="url(#h-skyl)" opacity="0.45"/>')
    # lớp trời thứ hai nhạt hơn, mép lượn, nối xuống cỏ ⇒ không còn mép ngang cứng
    parts.append(f'<path d="M-40 260 C240 330 520 250 820 300 C1100 350 1340 270 {W + 40} 320 V760 H-40 Z" fill="url(#h-skyl)" opacity="0.18"/>')
    parts.append(bunting(-20, 30, 1640, 40, 90, 22, 38))
    parts.append(sun(800, 215, 46))
    parts.append(cloud(260, 150, 0.9))
    parts.append(cloud(1080, 120, 1.0))
    parts.append(hot_air_balloon(1440, 190, 0.9))
    parts.append(cloud(1350, 330, 0.7))
    # diều giữa 2 cột
    parts.append(f'<path d="M760 420 C 720 520, 690 600, 660 690" fill="none" stroke="{INK}" stroke-width="2.5" stroke-opacity="0.6"/>')
    parts.append(fill("M760 330 L800 380 L760 430 L720 380 Z", "pink", w=4))
    parts.append(f'<path d="M760 430 q14 18 0 32 q-14 14 0 30" fill="none" stroke="{COLORS["blue"]}" stroke-width="6" stroke-linecap="round"/>')
    parts.append(butterfly(700, 520, 1.1, "sky"))
    parts.append(butterfly(1360, 560, 0.9, "pink"))
    # cỏ
    parts.append(grass_band(W, 740, 200))
    # sân chơi bên trái
    parts.append(swing_set(110, 600, 0.9))
    parts.append(kid(205, 640, 0.75, shirt="pink", hair="hair2", arms="hold", legs="sit", girl=True))
    parts.append(slide(400, 590, 0.95))
    parts.append(kid(470, 560, 0.7, shirt="sky", hair="hair", arms="up"))
    parts.append(kid(640, 690, 0.85, shirt="orange", hair="hair", arms="wave"))
    parts.append(tree(1470, 690, 1.0))
    parts.append(balloon(1340, 640, "yellow", 0.9))
    parts.append(balloon(1385, 610, "blue", 0.8))
    parts.append(balloon(1300, 600, "mint", 0.75))
    for x, y, c in [(90, 830, "pink"), (330, 860, "yellow"), (560, 845, "sky"), (820, 860, "pink"), (1080, 850, "yellow"), (1250, 870, "sky"), (1540, 850, "pink")]:
        parts.append(flower(x, y, c, 0.9))
    return page("".join(parts), W, H, "Tranh nền trang đăng nhập (sáp màu)")


def hero_scene():
    W, H = 1040, 440
    parts = []
    parts.append(bunting(470, 20, 1060, 24, 50, 10, 30))
    parts.append(sun(960, 110, 34))
    parts.append(cloud(620, 90, 0.6))
    parts.append(balloon(540, 170, "yellow", 0.7))
    parts.append(balloon(580, 150, "sky", 0.6))
    parts.append(f'<path d="M500 460 C 540 380, 660 336, 820 342 S 1000 322, 1060 330 V 460 Z" fill="url(#h-mint)"/>')
    parts.append(f'<path d="M500 460 C 540 380, 660 336, 820 342 S 1000 322, 1060 330" fill="none" stroke="{OUTLINE["mint"]}" stroke-width="5"/>')
    parts.append(seesaw(800, 330, 0.75))
    parts.append(kid(700, 268, 0.62, shirt="blue", hair="hair", arms="up"))
    parts.append(kid(908, 234, 0.62, shirt="pink", hair="hair2", arms="up", girl=True))
    parts.append(tree(1000, 300, 0.55, "green"))
    parts.append(butterfly(640, 230, 0.8, "pink"))
    parts.append(flower(560, 400, "pink", 0.7))
    parts.append(flower(980, 410, "yellow", 0.7))
    return page("".join(parts), W, H, "Tranh banner chào dashboard (sáp màu, nền trong suốt)", paper=False)


def ground_scene():
    """Dải sân chơi ở đáy trang đăng nhập (nền trong suốt): cỏ, xích đu, cầu trượt, các bé, cây, bóng bay, hoa."""
    W, H = 1600, 360
    parts = ['<g transform="translate(0 -540)">']
    parts.append(grass_band(W, 740, 200))
    parts.append(swing_set(110, 600, 0.9))
    parts.append(kid(205, 640, 0.75, shirt="pink", hair="hair2", arms="hold", legs="sit", girl=True))
    parts.append(slide(400, 590, 0.95))
    parts.append(kid(470, 560, 0.7, shirt="sky", hair="hair", arms="up"))
    parts.append(kid(700, 690, 0.85, shirt="orange", hair="hair", arms="wave"))
    parts.append(seesaw(1040, 720, 0.8))
    parts.append(kid(935, 650, 0.62, shirt="blue", hair="hair", arms="up"))
    parts.append(kid(1145, 618, 0.62, shirt="pink", hair="hair2", arms="up", girl=True))
    parts.append(tree(1470, 690, 1.0))
    parts.append(balloon(1330, 640, "yellow", 0.9))
    parts.append(balloon(1375, 610, "blue", 0.8))
    parts.append(butterfly(820, 600, 0.9, "pink"))
    for x, y, c in [(90, 830, "pink"), (330, 860, "yellow"), (560, 845, "sky"), (820, 860, "pink"), (1080, 850, "yellow"), (1250, 870, "sky"), (1540, 850, "pink")]:
        parts.append(flower(x, y, c, 0.9))
    parts.append("</g>")
    return page("".join(parts), W, H, "Dải sân chơi đáy trang đăng nhập (sáp màu, nền trong suốt)", paper=False)


if __name__ == "__main__":
    (HERE / "login-scene.html").write_text(login_scene(), encoding="utf-8")
    (HERE / "ground-scene.html").write_text(ground_scene(), encoding="utf-8")
    (HERE / "hero-scene.html").write_text(hero_scene(), encoding="utf-8")
    print("ok")
