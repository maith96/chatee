"""Generate the Sasamigo logo SVGs in public/brand/ with text as outlines.

Usage: pip install fonttools; download Nunito 900 and Montserrat 700 TTFs into FONTS_DIR as
Nunito.ttf and Montserrat.ttf; then: python3 scripts/make-logo.py FONTS_DIR public/brand
"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

ORANGE, TEAL, CREAM, WHITE, BLACK = "#E8642C", "#0F3D3E", "#FBF6EE", "#FFFFFF", "#141414"


class Face:
    def __init__(self, path):
        self.f = TTFont(path)
        self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap()
        self.upm = self.f["head"].unitsPerEm
        self.hmtx = self.f["hmtx"]
        os2 = self.f["OS/2"]
        self.xh = getattr(os2, "sxHeight", 0) or 0.5 * self.upm
        self.cap = getattr(os2, "sCapHeight", 0) or 0.7 * self.upm

    def width(self, text, size, track=0.0):
        s = size / self.upm
        w = sum(self.hmtx[self.cmap[ord(c)]][0] * s for c in text)
        return w + track * size * (len(text) - 1)

    def path(self, text, x, baseline, size, track=0.0):
        s = size / self.upm
        out = []
        for c in text:
            g = self.cmap[ord(c)]
            pen = SVGPathPen(self.gs)
            self.gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, baseline)))
            d = pen.getCommands()
            if d:
                out.append(d)
            x += self.hmtx[g][0] * s + track * size
        return " ".join(out)


nunito = Face(os.path.join(FONTS, "Nunito.ttf"))
mont = Face(os.path.join(FONTS, "Montserrat.ttf"))

# ---- the mark, drawn in a 200 x 200 box ----
BUBBLE = ("M106 6C156.8 6 198 44.5 198 92S156.8 178 106 178C93 178 80.6 175.6 69.4 171.2"
          "L16.5 196.4C11.6 198.7 7.4 194.1 10.2 189.5L39.6 141.5C23.9 126.1 14 110 14 92"
          "C14 44.5 55.2 6 106 6Z")
DOTS = [(71, 84), (106, 84), (141, 84)]
SMILE = "M80 117C89 133 123 133 132 117"


def mark(x, y, scale, body, face, uid):
    """Bubble plus face. face=None knocks the face out (one-colour use)."""
    t = f'transform="translate({x:.2f} {y:.2f}) scale({scale:.4f})"'
    if face is None:
        dots = "".join(f'<circle cx="{cx}" cy="{cy}" r="12.5" fill="#000"/>' for cx, cy in DOTS)
        return (f'<mask id="face-{uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">'
                f'<rect width="200" height="200" fill="#fff"/>{dots}'
                f'<path d="{SMILE}" fill="none" stroke="#000" stroke-width="11" stroke-linecap="round"/></mask>'
                f'<g {t}><path d="{BUBBLE}" fill="{body}" mask="url(#face-{uid})"/></g>')
    dots = "".join(f'<circle cx="{cx}" cy="{cy}" r="12.5" fill="{face}"/>' for cx, cy in DOTS)
    return (f'<g {t}><path d="{BUBBLE}" fill="{body}"/>{dots}'
            f'<path d="{SMILE}" fill="none" stroke="{face}" stroke-width="11" stroke-linecap="round"/></g>')


def svg(w, h, body, title, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
            f'width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{rect}{body}</svg>\n')


WORD_SIZE = 128
TAG = "FRIENDS WHO REMEMBER"
word_w = nunito.width("sasamigo", WORD_SIZE)
sasa_w = nunito.width("sasa", WORD_SIZE)
# size the tagline (with light tracking) so it runs the same width as the wordmark
tag_track = 0.1
TAG_SIZE = word_w / mont.width(TAG, 1, tag_track)
word_xh = nunito.xh * WORD_SIZE / nunito.upm
tag_cap = mont.cap * TAG_SIZE / mont.upm
GAP_WT = 34  # baseline of word to top of tagline caps


def wordmark(x, top, c_sasa, c_migo, c_tag):
    """Lowercase wordmark + tagline; `top` is the top of the x-height."""
    base = top + word_xh
    tag_base = base + GAP_WT + tag_cap
    return (f'<path d="{nunito.path("sasa", x, base, WORD_SIZE)}" fill="{c_sasa}"/>'
            f'<path d="{nunito.path("migo", x + sasa_w, base, WORD_SIZE)}" fill="{c_migo}"/>'
            f'<path d="{mont.path(TAG, x, tag_base, TAG_SIZE, tag_track)}" fill="{c_tag}"/>'), tag_base - top


# ---- horizontal logo ----
PAD, MARK = 24, 200
block_h = word_xh + GAP_WT + tag_cap
H = MARK + 2 * PAD
text_x = PAD + MARK + 40
W = text_x + word_w + PAD
text_top = PAD + 92 - block_h / 2  # centre the text block on the bubble's centre


def horizontal(body, face, c_sasa, c_migo, c_tag, uid, bg=None, title="Sasamigo — Friends who remember"):
    words, _ = wordmark(text_x, text_top, c_sasa, c_migo, c_tag)
    return svg(W, H, mark(PAD, PAD, 1, body, face, uid) + words, title, bg)


files = {
    "sasamigo-logo.svg": horizontal(ORANGE, WHITE, TEAL, ORANGE, TEAL, "a"),
    "sasamigo-logo-on-dark.svg": horizontal(ORANGE, WHITE, CREAM, ORANGE, CREAM, "b", bg=TEAL),
    "sasamigo-logo-black.svg": horizontal(BLACK, None, BLACK, BLACK, BLACK, "c"),
    "sasamigo-logo-white.svg": horizontal(WHITE, None, WHITE, WHITE, WHITE, "d"),
}

# ---- stacked logo ----
SW = max(word_w, MARK) + 2 * PAD + 40
mx = (SW - MARK) / 2
wx = (SW - word_w) / 2
asc_room = 0.25 * WORD_SIZE  # room for the "i" dot above the x-height
words, wh = wordmark(wx, PAD + MARK + 36 + asc_room, TEAL, ORANGE, TEAL)
SH = PAD + MARK + 36 + asc_room + wh + PAD
files["sasamigo-logo-stacked.svg"] = svg(SW, SH, mark(mx, PAD, 1, ORANGE, WHITE, "e") + words,
                                         "Sasamigo — Friends who remember")

# ---- mark only ----
files["sasamigo-mark.svg"] = svg(200, 200, mark(0, 0, 1, ORANGE, WHITE, "f"), "Sasamigo")
files["sasamigo-mark-black.svg"] = svg(200, 200, mark(0, 0, 1, BLACK, None, "g"), "Sasamigo")

# ---- app icon: full-bleed square (stores round the corners themselves) ----
ICON = 1024
s = 0.62 * ICON / 200
off = (ICON - 200 * s) / 2
files["sasamigo-app-icon.svg"] = svg(ICON, ICON, mark(off + 4 * s, off + 6 * s, s, WHITE, ORANGE, "h"),
                                     "Sasamigo app icon", bg=ORANGE)
# rounded version for websites and previews
files["sasamigo-app-icon-rounded.svg"] = svg(
    ICON, ICON,
    f'<rect width="{ICON}" height="{ICON}" rx="{0.225 * ICON:.0f}" fill="{ORANGE}"/>'
    + mark(off + 4 * s, off + 6 * s, s, WHITE, ORANGE, "i"),
    "Sasamigo app icon")

for name, content in files.items():
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(content)
    print(name, f"{len(content) / 1024:.1f} KB")
print("tagline tracking", round(tag_track, 4))
