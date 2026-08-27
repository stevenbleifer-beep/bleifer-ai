import os, math, random
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.expanduser("~/github-pages/bleifer-ai/img")
os.makedirs(OUT, exist_ok=True)
FD = ["/System/Library/Fonts/Supplemental", "/System/Library/Fonts", "/Library/Fonts"]

def font(names, size):
    for n in names:
        for d in FD:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()

MAGIC = (255, 0, 255)

def to_p(img, palette):
    pal = []
    for c in palette:
        pal.extend(c)
    pal += [0, 0, 0] * (256 - len(palette))
    pi = Image.new("P", (1, 1)); pi.putpalette(pal)
    return img.convert("RGB").quantize(palette=pi, dither=Image.NONE)

def save(frames, name, dur, palette, transparent=False):
    ps = [to_p(f, palette) for f in frames]
    kw = dict(save_all=True, append_images=ps[1:], duration=dur, loop=0, optimize=False)
    if transparent:
        kw.update(transparency=0, disposal=2)
    ps[0].save(os.path.join(OUT, name), **kw)
    print("wrote", name, ps[0].size, len(ps), "frames")

def ctr(d, box, text, f, fill):
    x0, y0, x1, y1 = box
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    d.text((x0 + (x1 - x0 - (r - l)) / 2 - l, y0 + (y1 - y0 - (b - t)) / 2 - t), text, font=f, fill=fill)

# ---------------------------------------------------------------- starfield bg
random.seed(1995)
W = H = 120
stars = [(random.randrange(W), random.randrange(H), random.random()) for _ in range(46)]
frames = []
for fr in range(4):
    im = Image.new("RGB", (W, H), (8, 8, 40)); d = ImageDraw.Draw(im)
    for i, (x, y, ph) in enumerate(stars):
        tw = (fr + int(ph * 4)) % 4
        if i % 3 == 0:
            c = [(255,255,255),(160,160,220),(90,90,150),(160,160,220)][tw]
        else:
            c = (200, 200, 255) if i % 2 else (120, 120, 190)
        d.point((x, y), fill=c)
        if i % 7 == 0 and tw == 0:
            d.point(((x+1)%W, y), fill=(90,90,150)); d.point((x, (y+1)%H), fill=(90,90,150))
    frames.append(im)
save(frames, "stars.gif", 400, [(8,8,40),(255,255,255),(200,200,255),(160,160,220),(120,120,190),(90,90,150)])

# --------------------------------------------------------------- spinning globe
S, R, M, F = 72, 32, 6, 12
CX = CY = S // 2
frames = []
for fr in range(F):
    im = Image.new("RGB", (S, S), MAGIC); d = ImageDraw.Draw(im)
    d.ellipse([CX-R, CY-R, CX+R, CY+R], fill=(10, 30, 110), outline=(120, 230, 255))
    for k in range(1, 4):                                   # latitudes
        for sgn in (-1, 1):
            y = sgn * k * R / 4
            rw = math.sqrt(max(R*R - y*y, 0))
            d.ellipse([CX-rw, CY+y-3, CX+rw, CY+y+3], outline=(60, 170, 240))
    d.line([CX-R, CY, CX+R, CY], fill=(120, 230, 255))       # equator
    rot = fr / F * math.pi / M
    for k in range(M):                                       # meridians
        hw = abs(math.cos(math.pi * k / M + rot)) * R
        d.ellipse([CX-hw, CY-R, CX+hw, CY+R], outline=(90, 200, 250))
    d.ellipse([CX-R, CY-R, CX+R, CY+R], outline=(190, 245, 255))
    d.arc([CX-R+3, CY-R+3, CX+R-9, CY+R-9], 200, 260, fill=(230, 255, 255))  # highlight
    frames.append(im)
save(frames, "globe.gif", 90,
     [MAGIC,(10,30,110),(60,170,240),(90,200,250),(120,230,255),(190,245,255),(230,255,255)], True)

# ------------------------------------------------------- under construction bar
W, H, F = 360, 46, 8
fb = font(["Arial Black.ttf", "Impact.ttf"], 21)
frames = []
for fr in range(F):
    im = Image.new("RGB", (W, H), (255, 206, 0)); d = ImageDraw.Draw(im)
    off = fr * 4
    for x in range(-40, W + 40, 20):                          # scrolling hazard stripes
        for (y0, y1) in ((0, 10), (H - 10, H)):
            d.polygon([(x+off, y1), (x+off+10, y1), (x+off+22, y0), (x+off+12, y0)], fill=(20, 20, 20))
    d.rectangle([0, 10, W-1, H-11], fill=(255, 206, 0))
    d.rectangle([0, 0, W-1, H-1], outline=(20, 20, 20))
    ctr(d, (0, 9, W, H-9), "UNDER CONSTRUCTION", fb, (20, 20, 20))
    frames.append(im)
save(frames, "construction.gif", 110, [(255,206,0),(20,20,20),(140,113,0)])

# ------------------------------------------------------------- digging worker
W, H, F = 44, 52, 6
frames = []
for fr in range(F):
    im = Image.new("RGB", (W, H), MAGIC); d = ImageDraw.Draw(im)
    dig = math.sin(fr / F * 2 * math.pi)
    d.rectangle([0, 46, W-1, H-1], fill=(120, 78, 40))                 # ground
    pile = 5 + int(3 * (1 + dig))
    d.polygon([(30, 46), (38, 46-pile), (43, 46)], fill=(150, 100, 55))
    d.rectangle([15, 34, 19, 46], fill=(30, 40, 90))                   # legs
    d.rectangle([22, 34, 26, 46], fill=(30, 40, 90))
    d.rectangle([13, 20, 28, 35], fill=(255, 120, 0))                  # vest
    d.rectangle([18, 20, 23, 35], fill=(240, 240, 240))
    d.ellipse([14, 6, 27, 19], fill=(240, 200, 160))                   # head
    d.chord([12, 1, 29, 15], 180, 360, fill=(255, 214, 0))             # hard hat
    d.rectangle([11, 12, 30, 14], fill=(255, 214, 0))
    a = -0.75 + 0.95 * (dig + 1) / 2                                   # shovel swing
    sx, sy = 24, 23
    hx, hy = sx + 17 * math.cos(a), sy + 17 * math.sin(a)
    d.line([sx, sy, hx, hy], fill=(165, 110, 60), width=3)             # handle
    bx, by = sx + 23 * math.cos(a), sy + 23 * math.sin(a)
    d.polygon([(bx-4, by-4), (bx+5, by-2), (bx+3, by+5), (bx-5, by+3)], fill=(190, 195, 205))
    d.line([sx-2, sy+1, hx, hy], fill=(240, 200, 160), width=2)        # arm
    frames.append(im)
save(frames, "worker.gif", 130,
     [MAGIC,(120,78,40),(150,100,55),(30,40,90),(255,120,0),(240,240,240),
      (240,200,160),(255,214,0),(165,110,60),(190,195,205)], True)

# --------------------------------------------------------------- blinking NEW!
W, H = 46, 18
fn = font(["Arial Black.ttf"], 13)
frames = []
for bg, fg in (((210, 0, 0), (255, 240, 0)), ((255, 240, 0), (210, 0, 0))):
    im = Image.new("RGB", (W, H), bg); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W-1, H-1], outline=fg)
    ctr(d, (0, 0, W, H), "NEW!", fn, fg)
    frames.append(im)
save(frames, "new.gif", 400, [(210,0,0),(255,240,0),(232,120,0)])

# ------------------------------------------------------------ envelope / email
W, H, F = 40, 28, 6
frames = []
for fr in range(F):
    im = Image.new("RGB", (W, H), MAGIC); d = ImageDraw.Draw(im)
    open_amt = (math.sin(fr / F * 2 * math.pi) + 1) / 2
    d.rectangle([4, 6, 35, 25], fill=(250, 250, 235), outline=(40, 40, 40))
    ty = 6 - int(5 * open_amt)
    d.polygon([(4, 6), (35, 6), (20, 6 + 11 * (1 - open_amt) + 2)], fill=(225, 225, 205), outline=(40, 40, 40))
    d.polygon([(4, ty), (35, ty), (20, ty + 12)], fill=(238, 238, 220), outline=(40, 40, 40))
    d.line([4, 25, 18, 15], fill=(150, 150, 140)); d.line([35, 25, 22, 15], fill=(150, 150, 140))
    frames.append(im)
save(frames, "mail.gif", 140,
     [MAGIC,(250,250,235),(238,238,220),(225,225,205),(150,150,140),(40,40,40)], True)

# ----------------------------------------------------------- rainbow hr divider
W, H, F = 468, 12, 14
RB = [(255,0,0),(255,110,0),(255,225,0),(0,200,40),(0,140,255),(60,60,230),(160,50,220)]
frames = []
for fr in range(F):
    im = Image.new("RGB", (W, H), (0, 0, 0)); d = ImageDraw.Draw(im)
    for x in range(W):
        d.line([x, 0, x, H], fill=RB[((x // 12) + fr) % len(RB)])
    for x in range(W):                                   # bevel shading
        d.point((x, 0), fill=(255, 255, 255)); d.point((x, H-1), fill=(0, 0, 0))
    frames.append(im)
save(frames, "rainbow.gif", 90, RB + [(255,255,255),(0,0,0)])

# ------------------------------------------------------------------ 88x31 badges
fbg = font(["Arial Bold.ttf"], 10)
for name, l1, l2, bg, fg, ac in [
    ("badge_800.gif",  "BEST VIEWED AT", "800 x 600",      (0,0,140),   (255,255,255), (255,215,0)),
    ("badge_html.gif", "MADE WITH",      "PLAIN HTML",     (20,20,20),  (0,255,120),   (255,255,255)),
    ("badge_mac.gif",  "HAND CODED ON",  "A MACINTOSH",    (120,0,0),   (255,255,255), (255,190,60)),
]:
    im = Image.new("RGB", (88, 31), bg); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 87, 30], outline=ac)
    d.rectangle([1, 1, 86, 29], outline=fg)
    ctr(d, (0, 2, 88, 16), l1, fbg, fg)
    ctr(d, (0, 15, 88, 29), l2, fbg, ac)
    to_p(im, [bg, fg, ac, (128,128,128)]).save(os.path.join(OUT, name))
    print("wrote", name)
