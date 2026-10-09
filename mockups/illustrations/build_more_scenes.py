"""Thêm 8 chủ đề sáp màu + 4 kiểu nét sáp (style) cho CareNest."""
import math
from pathlib import Path

import build_theme_scenes as t  # đã nạp màu bổ sung và nét vẽ gốc

b = t.b
fill, circle_d, line, kid, sun, cloud, star, INK = t.fill, t.circle_d, t.line, t.kid, t.sun, t.cloud, t.star, t.INK
W, H = t.W, t.H
HERE = Path(__file__).parent
ORIGINAL_DEFS = b.defs

# ---------- Kiểu nét sáp ----------
# Bảng màu tươi hơn (user thấy tranh nhạt): tăng độ bão hòa, giữ đúng sắc
VIVID = {"blue": "#0B5FE0", "sky": "#2EA3F2", "skyl": "#5BBEFF", "mint": "#5FD3A2", "green": "#28B36E", "yellow": "#FFC20E",
         "orange": "#FF8A1F", "pink": "#FF6FA8", "red": "#F0353C", "purple": "#8E74F0", "navy": "#33429E", "cream": "#FFD98A",
         "sand": "#F2C878", "leaf": "#F27A1A", "brown": "#A8692F"}
b.COLORS.update(VIVID)

STYLES = {
    # mặc định: gạch chéo vừa, lộ giấy
    "sap": dict(size=8, stroke=6, op=0.48, cross=0.7, grain=0.85, wobble=5, bg="#FCFDFF"),
    # sáp tô đậm: nét dày, màu đặc hơn
    "sap-dam": dict(size=9, stroke=8, op=0.68, cross=0.85, grain=0.7, wobble=6, bg="#FFFDF8"),
    # bút chì màu: nét mảnh, thưa, rất nhẹ
    "chi-mau": dict(size=6, stroke=2.2, op=0.24, cross=0.5, grain=1.2, wobble=3, bg="#FFFFFF"),
    # sáp dầu: mảng mềm, gần như đặc, rung mạnh
    "sap-dau": dict(size=10, stroke=9, op=0.82, cross=0.7, grain=0.45, wobble=10, bg="#FFFBF2"),
    # sáp trên giấy kraft
    "giay-kraft": dict(size=8, stroke=6, op=0.55, cross=0.7, grain=0.85, wobble=5, bg="#EBD8B5"),
}


def styled_defs(st):
    def defs():
        pats = []
        for name, col in b.COLORS.items():
            sz, half = st["size"], st["size"] / 2
            pats.append(
                f'<pattern id="h-{name}" width="{sz}" height="{sz}" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">'
                f'<rect width="{sz}" height="{sz}" fill="{col}" fill-opacity="{st["op"]}"/>'
                f'<line x1="0" y1="{half}" x2="{sz}" y2="{half}" stroke="{col}" stroke-width="{st["stroke"]}"/></pattern>'
            )
            pats.append(
                f'<pattern id="x-{name}" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(52)">'
                f'<line x1="0" y1="5.5" x2="11" y2="5.5" stroke="{col}" stroke-width="{max(1.2, st["stroke"] * 0.55):.1f}" stroke-opacity="{st["cross"]}"/></pattern>'
            )
        return f"""<defs>{''.join(pats)}
    <filter id="wax" x="-3%" y="-3%" width="106%" height="106%">
      <feTurbulence type="fractalNoise" baseFrequency="{st['grain']}" numOctaves="2" seed="3" result="n" />
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.3 1.78" result="m" />
      <feComposite in="SourceGraphic" in2="m" operator="in" result="g" />
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="6" result="w" />
      <feDisplacementMap in="g" in2="w" scale="{st['wobble']}" xChannelSelector="R" yChannelSelector="G" />
    </filter></defs>"""
    return defs


def render_with(style, scene_fn):
    st = STYLES[style]
    b.defs = styled_defs(st)
    html = scene_fn()
    b.defs = ORIGINAL_DEFS
    # nền giấy theo kiểu
    return html.replace('fill="#FCFDFF"/>', f'fill="{st["bg"]}"/>', 1)


# ---------- Hình mới ----------
def duck(x, y, s=1.0):
    body = f"M{x - 40 * s} {y} Q{x - 40 * s} {y + 34 * s} {x} {y + 34 * s} Q{x + 44 * s} {y + 34 * s} {x + 40 * s} {y - 4 * s} Q{x} {y + 6 * s} {x - 40 * s} {y} Z"
    return fill(body, "yellow", w=4 * s) + fill(circle_d(x + 30 * s, y - 20 * s, 18 * s), "yellow", w=4 * s) + fill(f"M{x + 46 * s} {y - 22 * s} l{18 * s} {6 * s} l{-18 * s} {6 * s} Z", "orange", cross=False, w=3) + f'<circle cx="{x + 34 * s}" cy="{y - 24 * s}" r="{3 * s}" fill="{INK}"/>'


def fish(x, y, col="orange", s=1.0):
    return fill(f"M{x - 34 * s} {y} Q{x} {y - 26 * s} {x + 30 * s} {y} Q{x} {y + 26 * s} {x - 34 * s} {y} Z", col, w=3.5 * s) + fill(f"M{x + 26 * s} {y} l{22 * s} {-16 * s} v{32 * s} Z", col, cross=False, w=3) + f'<circle cx="{x - 18 * s}" cy="{y - 4 * s}" r="{3 * s}" fill="{INK}"/>'


def lily(x, y, s=1.0):
    return fill(f"M{x} {y} m{-40 * s} 0 a{40 * s} {16 * s} 0 1 0 {80 * s} 0 a{40 * s} {16 * s} 0 1 0 {-80 * s} 0 Z", "green", w=3.5 * s) + t.flower(x + 6 * s, y - 14 * s, "pink", 0.7 * s)


def rocket(x, y, s=1.0):
    body = f"M{x} {y - 120 * s} Q{x + 44 * s} {y - 60 * s} {x + 34 * s} {y + 40 * s} H{x - 34 * s} Q{x - 44 * s} {y - 60 * s} {x} {y - 120 * s} Z"
    return (fill(f"M{x - 22 * s} {y + 40 * s} Q{x} {y + 120 * s} {x + 22 * s} {y + 40 * s} Z", "orange", cross=False, w=3)
            + fill(f"M{x - 34 * s} {y + 10 * s} l{-30 * s} {40 * s} h{30 * s} Z", "red", w=3.5) + fill(f"M{x + 34 * s} {y + 10 * s} l{30 * s} {40 * s} h{-30 * s} Z", "red", w=3.5)
            + fill(body, "white", cross=False, w=5 * s) + fill(circle_d(x, y - 50 * s, 18 * s), "sky", w=4 * s))


def planet(x, y, r, col, ring=True):
    out = fill(circle_d(x, y, r), col, w=4)
    if ring:
        out += f'<ellipse cx="{x}" cy="{y}" rx="{r * 1.7}" ry="{r * 0.42}" fill="none" stroke="{b.OUTLINE["yellow"]}" stroke-width="7" transform="rotate(-18 {x} {y})"/>'
    return out


def rainbow(cx, cy, r0):
    cols = ["red", "orange", "yellow", "green", "sky", "purple"]
    return "".join(f'<path d="M{cx - (r0 - i * 22)} {cy} A{r0 - i * 22} {r0 - i * 22} 0 0 1 {cx + (r0 - i * 22)} {cy}" fill="none" stroke="{b.COLORS[c]}" stroke-width="22" stroke-opacity="0.75"/>' for i, c in enumerate(cols))


def umbrella(x, y, col, s=1.0):
    canopy = f"M{x - 60 * s} {y} A{60 * s} {54 * s} 0 0 1 {x + 60 * s} {y} q{-15 * s} {-12 * s} {-30 * s} 0 q{-15 * s} {-12 * s} {-30 * s} 0 q{-15 * s} {-12 * s} {-30 * s} 0 q{-15 * s} {-12 * s} {-30 * s} 0 Z"
    return line(x, y, x, y + 70 * s, INK, 4) + f'<path d="M{x} {y + 70 * s} q0 {12 * s} {-12 * s} {12 * s}" fill="none" stroke="{INK}" stroke-width="4"/>' + fill(canopy, col, w=4 * s)


def rain(x0, x1, y0, y1, n=40):
    out = []
    for i in range(n):
        x = x0 + (i * 137) % (x1 - x0)
        y = y0 + (i * 89) % (y1 - y0)
        out.append(f'<path d="M{x} {y} q4 10 0 14 q-4 -4 0 -14" fill="{b.COLORS["sky"]}" opacity="0.8"/>')
    return "".join(out)


def elephant(x, y, s=1.0):
    return (fill(f"M{x - 70 * s} {y} Q{x - 74 * s} {y - 80 * s} {x} {y - 80 * s} Q{x + 74 * s} {y - 80 * s} {x + 70 * s} {y} Z", "sky", w=4 * s)
            + "".join(fill(f"M{x + dx * s} {y - 4 * s} h{22 * s} v{40 * s} h{-22 * s} Z", "sky", w=3.5 * s) for dx in (-60, -24, 20, 48))
            + fill(circle_d(x + 70 * s, y - 70 * s, 38 * s), "sky", w=4 * s) + fill(circle_d(x + 50 * s, y - 72 * s, 24 * s), "skyl", w=3 * s)
            + f'<path d="M{x + 100 * s} {y - 60 * s} q{20 * s} {40 * s} {-4 * s} {66 * s}" fill="none" stroke="{b.OUTLINE["sky"]}" stroke-width="{14 * s}" stroke-linecap="round"/>'
            + f'<circle cx="{x + 80 * s}" cy="{y - 80 * s}" r="{4 * s}" fill="{INK}"/>')


def giraffe(x, y, s=1.0):
    spots = "".join(fill(circle_d(x + dx * s, y + dy * s, 8 * s), "brown", cross=False, w=1.5) for dx, dy in [(-30, -40), (10, -30), (30, -50), (46, -150), (40, -110)])
    return ("".join(line(x + dx * s, y - 20 * s, x + dx * s, y + 40 * s, b.OUTLINE["yellow"], 9 * s) for dx in (-40, -16, 24, 46))
            + fill(f"M{x - 54 * s} {y - 70 * s} h{112 * s} v{56 * s} h{-112 * s} Z", "yellow", w=4 * s)
            + fill(f"M{x + 30 * s} {y - 70 * s} l{8 * s} {-120 * s} h{24 * s} l{-4 * s} {120 * s} Z", "yellow", w=4 * s)
            + fill(f"M{x + 30 * s} {y - 200 * s} h{56 * s} v{30 * s} h{-56 * s} Z", "yellow", w=4 * s) + spots + f'<circle cx="{x + 70 * s}" cy="{y - 190 * s}" r="{4 * s}" fill="{INK}"/>')


def bus(x, y, s=1.0):
    out = [fill(f"M{x} {y} h{300 * s} v{110 * s} h{-300 * s} Z", "yellow", w=5 * s)]
    for i in range(4):
        out.append(fill(f"M{x + (20 + i * 66) * s} {y + 18 * s} h{50 * s} v{40 * s} h{-50 * s} Z", "skyl", w=3 * s))
    out += [fill(circle_d(x + 70 * s, y + 112 * s, 26 * s), "navy", w=4 * s), fill(circle_d(x + 230 * s, y + 112 * s, 26 * s), "navy", w=4 * s),
            line(x, y + 78 * s, x + 300 * s, y + 78 * s, b.COLORS["red"], 6)]
    return "".join(out)


def cake(x, y, s=1.0):
    out = [fill(f"M{x - 110 * s} {y} h{220 * s} v{-70 * s} h{-220 * s} Z", "pink", w=5 * s),
           fill(f"M{x - 80 * s} {y - 70 * s} h{160 * s} v{-60 * s} h{-160 * s} Z", "cream", w=5 * s)]
    for dx in (-50, 0, 50):
        out.append(fill(f"M{x + dx * s - 6 * s} {y - 130 * s} h{12 * s} v{-40 * s} h{-12 * s} Z", "sky", cross=False, w=3))
        out.append(fill(f"M{x + dx * s} {y - 186 * s} q{10 * s} {10 * s} 0 {16 * s} q{-10 * s} {-6 * s} 0 {-16 * s} Z", "orange", cross=False, w=2))
    return "".join(out)


def gift(x, y, col, s=1.0):
    return fill(f"M{x} {y} h{70 * s} v{60 * s} h{-70 * s} Z", col, w=4 * s) + line(x + 35 * s, y, x + 35 * s, y + 60 * s, b.COLORS["yellow"], 7) + line(x, y + 24 * s, x + 70 * s, y + 24 * s, b.COLORS["yellow"], 7)


def mid_lantern_star(x, y, s=1.0):
    return line(x, y - 90 * s, x, y - 40 * s, INK, 3) + star(x, y, 46 * s, "red") + star(x, y, 22 * s, "yellow")


# ---------- 8 chủ đề mới ----------
def ao_ca():
    p = [t.sky(), sun(1350, 160, 44), cloud(400, 140, 0.9), t.ground("mint", 560)]
    p.append(fill(f"M200 700 C200 600 600 580 800 600 S1400 590 1420 700 S1100 860 800 860 S200 820 200 700 Z", "sky", w=5))
    p += [duck(520, 680, 1.1), duck(900, 720, 0.9), fish(700, 790, "orange"), fish(1080, 770, "red", 0.9), lily(1200, 680), lily(360, 760, 0.8),
          kid(110, 520, 1.0, "pink", "hair2", arms="wave", girl=True), t.tree(1520, 600, 1.0)]
    return t.page("".join(p), W, H, "Ao cá vịt bơi")


def vu_tru():
    p = [f'<path d="M-40 -40 H{W + 40} V{H + 40} H-40 Z" fill="url(#h-navy)" opacity="0.28"/>']
    for i, (x, y) in enumerate([(120, 100), (300, 300), (520, 140), (700, 420), (860, 90), (1060, 260), (1240, 120), (1480, 330), (200, 560), (980, 600), (1400, 700)]):
        p.append(star(x, y, 14 + (i % 3) * 6, "yellow"))
    p += [planet(300, 700, 80, "orange"), planet(1300, 220, 60, "pink"), planet(1500, 600, 40, "mint", False), t.moon(180, 200, 60), rocket(820, 520, 1.3)]
    return t.page("".join(p), W, H, "Bay vào vũ trụ")


def mua_mua():
    p = [t.sky("skyl", 0.5), cloud(260, 120, 1.2), cloud(760, 90, 1.3), cloud(1240, 130, 1.1), rain(80, 1520, 220, 620, 60), t.ground("mint", 690)]
    p += [rainbow(1300, 690, 260), umbrella(520, 520, "red", 1.2), kid(520, 600, 1.0, "yellow", arms="hold"), umbrella(820, 540, "sky", 1.1), kid(820, 610, 0.95, "pink", "hair2", arms="hold", girl=True)]
    p += [f'<ellipse cx="300" cy="790" rx="90" ry="20" fill="{b.COLORS["sky"]}" opacity="0.5"/>', f'<ellipse cx="1050" cy="820" rx="120" ry="22" fill="{b.COLORS["sky"]}" opacity="0.5"/>', t.flowers_row(840)]
    return t.page("".join(p), W, H, "Mưa và cầu vồng")


def so_thu():
    p = [t.sky(), sun(220, 150, 44), cloud(800, 120, 1.0), t.ground("green", 690), t.fence(-20, W + 20, 640, 60)]
    p += [giraffe(350, 690, 1.1), elephant(800, 720, 1.1), kid(1150, 590, 1.0, "orange", arms="wave"), kid(1320, 600, 0.95, "mint", "hair2", arms="up", girl=True), t.tree(1520, 650, 1.0)]
    return t.page("".join(p), W, H, "Đi thăm sở thú")


def trung_thu():
    p = [f'<path d="M-40 -40 H{W + 40} V700 H-40 Z" fill="url(#h-navy)" opacity="0.25"/>', fill(circle_d(1300, 200, 110), "yellow", w=6)]
    p += [mid_lantern_star(400, 300), mid_lantern_star(620, 260, 0.9), t.lantern(860, 300, 1.2), t.ground("purple", 690)]
    for x, y in [(160, 140), (560, 120), (1000, 160), (1560, 420)]:
        p.append(star(x, y, 14, "yellow"))
    p += [kid(420, 600, 1.05, "red", arms="hold"), kid(640, 610, 1.0, "yellow", "hair2", arms="hold", girl=True), kid(900, 610, 1.0, "sky", arms="wave"),
          fill("M1150 760 h160 v-60 h-160 Z", "brown", w=4), fill(circle_d(1190, 690, 26), "cream", w=3), fill(circle_d(1270, 690, 26), "cream", w=3)]
    return t.page("".join(p), W, H, "Đêm trăng Trung thu")


def den_truong():
    p = [t.sky(), sun(1380, 150, 46), cloud(300, 120, 1.0), t.ground("mint", 720)]
    p.append(t.house(980, 470, 1.9, "cream", "red"))
    p.append(fill("M-40 760 H1640 V830 H-40 Z", "sand", w=4))
    p += [bus(120, 640, 1.2), kid(620, 620, 1.0, "sky", arms="wave"), kid(780, 630, 0.95, "pink", "hair2", arms="wave", girl=True), t.tree(1500, 720, 1.1)]
    p += [b.bunting(1000, 420, 1300, 430, 30, 6, 26)]
    return t.page("".join(p), W, H, "Bé đến trường")


def cau_vong():
    p = [t.sky("skyl", 0.4), rainbow(800, 720, 520), cloud(300, 640, 1.4), cloud(1300, 640, 1.4), sun(1400, 140, 40)]
    p += [fill("M-40 720 C300 640 600 760 900 700 S1400 650 1640 720 V940 H-40 Z", "green", w=5), fill("M-40 790 C400 740 800 830 1640 780 V940 H-40 Z", "mint", w=5)]
    p += [kid(560, 660, 1.0, "purple", arms="up"), kid(1040, 660, 1.0, "orange", "hair2", arms="up", girl=True), t.butterfly(800, 300, 1.2, "pink"), t.flowers_row(860)]
    return t.page("".join(p), W, H, "Đồi cầu vồng")


def sinh_nhat():
    p = [f'<path d="M-40 -40 H{W + 40} V680 H-40 Z" fill="url(#h-cream)" opacity="0.45"/>', b.bunting(-20, 30, 1640, 40, 80, 18, 36), t.ground("pink", 690)]
    p += [cake(800, 700, 1.2), gift(470, 640, "sky"), gift(1080, 650, "purple", 0.9), gift(1170, 680, "yellow", 0.7)]
    for x, y, c in [(240, 360, "red"), (330, 300, "sky"), (1320, 330, "yellow"), (1420, 380, "mint")]:
        p.append(t.balloon(x, y, c, 1.1))
    p += [kid(330, 590, 1.0, "yellow", arms="up"), kid(1330, 600, 1.0, "mint", "hair2", arms="wave", girl=True)]
    for x, y in [(600, 200), (980, 180), (760, 320)]:
        p.append(star(x, y, 16, "pink"))
    return t.page("".join(p), W, H, "Sinh nhật của bé")


NEW = {"ao-ca": ao_ca, "vu-tru": vu_tru, "mua-mua": mua_mua, "so-thu": so_thu, "trung-thu": trung_thu, "den-truong": den_truong, "cau-vong": cau_vong, "sinh-nhat": sinh_nhat}
# Biến thể kiểu nét: áp lên vài chủ đề để so sánh
VARIANTS = [("sap-dam", "cau-vong"), ("chi-mau", "vuon-rau"), ("sap-dau", "bien"), ("giay-kraft", "so-thu"), ("chi-mau", "dem-sao"), ("sap-dau", "sinh-nhat"), ("giay-kraft", "tet"), ("sap-dam", "lop-hoc")]

if __name__ == "__main__":
    all_scenes = {**t.SCENES, **NEW}
    # mọi chủ đề (cũ + mới) vẽ lại bằng nét sáp tươi
    for key, fn in all_scenes.items():
        (HERE / f"{key}.html").write_text(render_with("sap", fn), encoding="utf-8")
    for style, key in VARIANTS:
        (HERE / f"{key}--{style}.html").write_text(render_with(style, all_scenes[key]), encoding="utf-8")
    print("ok", len(NEW), len(VARIANTS))
