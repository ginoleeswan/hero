#!/usr/bin/env python3
"""store/compose.py — App Store screenshot composer.

Derived from the `aso-appstore-screenshots` skill's compose.py, which is
hardcoded to one canvas (1290x2796) and one device (iPhone). This adds the two
sizes Mythique actually submits and keeps everything else deterministic.

WHY DETERMINISTIC AND NOT AI. The skill's second stage sends the composed
scaffold to an image model to "enhance" it. That repaints the device frame and
can alter what is on the phone screen, and App Review 2.3 requires screenshots
to depict the real app. Every app pixel below comes from a simulator capture and
is only ever SCALED — never redrawn, never regenerated.

WHY THE CAPTURE CAN BE SMALLER THAN THE CANVAS. Apple's 6.9" slot is
1320x2868 and the only iPhone simulator installed here is a 6.3" (1206x2622).
Those two are the same shape to three decimal places (0.4600 vs 0.4603), so the
capture scales into the frame with no crop and no stretch — and because the
frame is smaller than the canvas, it is a DOWNSCALE. A full-bleed screenshot
would have needed a 1.09x upscale instead.

RELEASE BUILDS ONLY. A dev-client build paints a floating debug gear over the
app (see CLAUDE.md); it is not app UI and must not reach the store.
"""

import argparse
import os

from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "/Library/Fonts/SF-Pro-Display-Black.otf"

# One entry per App Store display slot. `device_w` includes the bezel; the
# screen area is what the capture is scaled into, and it is deliberately taller
# than the canvas leaves room for so the device bleeds off the bottom edge.
SIZES = {
    "iphone69": {
        "canvas": (1320, 2868),
        "device_w": 1054,
        "bezel": 15,
        "screen_r": 63,
        "device_y": 745,
        "text_top": 205,
        "verb_max": 262,
        "verb_min": 154,
        "desc_size": 127,
        "corner_r": 118,
    },
    "ipad13": {
        "canvas": (2064, 2752),
        "device_w": 1560,
        # An iPad's bezel is proportionally thinner than a phone's, and a
        # phone-sized one at this width reads as a picture frame.
        "bezel": 18,
        "screen_r": 42,
        "device_y": 800,
        "text_top": 190,
        "verb_max": 300,
        "verb_min": 170,
        "desc_size": 132,
        "corner_r": 62,
    },
}

VERB_DESC_GAP = 20
DESC_LINE_GAP = 24


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def wrap(draw, text, font, max_w):
    """Greedy wrap. Headlines are short, so this never needs to be cleverer."""
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_font(draw, text, max_w, size_max, size_min):
    for size in range(size_max, size_min - 1, -2):
        font = ImageFont.truetype(FONT_PATH, size)
        if draw.textlength(text, font=font) <= max_w:
            return font
    return ImageFont.truetype(FONT_PATH, size_min)


def draw_block(draw, canvas_w, y, text, font, max_w):
    for line in wrap(draw, text, font, max_w):
        bbox = draw.textbbox((0, 0), line, font=font)
        draw.text((canvas_w // 2, y - bbox[1]), line, fill="white", font=font, anchor="mt")
        y += (bbox[3] - bbox[1]) + DESC_LINE_GAP
    return y


def compose(size_key, bg_hex, verb, desc, shot_path, out_path):
    cfg = SIZES[size_key]
    canvas_w, canvas_h = cfg["canvas"]
    bg = hex_to_rgb(bg_hex)

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (*bg, 255))
    draw = ImageDraw.Draw(canvas)

    # Text sits in the top band. 0.86 rather than the skill's 0.92 because
    # nothing here is cropped afterwards — the canvas IS the delivered size — so
    # the margin buys optical breathing room instead of insurance.
    max_text_w = int(canvas_w * 0.86)
    verb_font = fit_font(draw, verb.upper(), max_text_w, cfg["verb_max"], cfg["verb_min"])
    desc_font = ImageFont.truetype(FONT_PATH, cfg["desc_size"])

    y = draw_block(draw, canvas_w, cfg["text_top"], verb.upper(), verb_font, max_text_w)
    y += VERB_DESC_GAP
    draw_block(draw, canvas_w, y, desc.upper(), desc_font, max_text_w)

    device_w = cfg["device_w"]
    bezel = cfg["bezel"]
    screen_w = device_w - 2 * bezel
    device_x = (canvas_w - device_w) // 2
    device_y = cfg["device_y"]
    screen_x, screen_y = device_x + bezel, device_y + bezel
    # Runs past the canvas so the device is cropped by the bottom edge rather
    # than floating above it.
    screen_h = canvas_h - screen_y + 400
    device_h = screen_h + bezel * 2

    # Shadow first, so the device sits on the background rather than against it.
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [device_x - 6, device_y + 10, device_x + device_w + 6, device_y + device_h],
        radius=cfg["corner_r"],
        fill=(0, 0, 0, 70),
    )
    canvas = Image.alpha_composite(canvas, shadow)

    # The device body: a rounded slab the screen is inset into.
    body = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle(
        [device_x, device_y, device_x + device_w, device_y + device_h],
        radius=cfg["corner_r"],
        fill=(16, 16, 18, 255),
    )
    canvas = Image.alpha_composite(canvas, body)

    # The capture, scaled to the screen width. The aspect agreement is checked
    # rather than assumed: a mismatch means a stretched screenshot, which is the
    # one failure mode nobody notices until it is on the store.
    shot = Image.open(shot_path).convert("RGBA")
    want, got = screen_w / screen_h, shot.width / shot.height
    scaled_h = round(shot.height * (screen_w / shot.width))
    shot = shot.resize((screen_w, scaled_h), Image.LANCZOS)

    scr = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(scr).rounded_rectangle(
        [screen_x, screen_y, screen_x + screen_w, screen_y + screen_h],
        radius=cfg["screen_r"],
        fill=(0, 0, 0, 255),
    )
    scr.paste(shot, (screen_x, screen_y))
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [screen_x, screen_y, screen_x + screen_w, screen_y + screen_h],
        radius=cfg["screen_r"],
        fill=255,
    )
    scr.putalpha(mask)
    canvas = Image.alpha_composite(canvas, scr)

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG")
    note = "" if abs(want - got) < 0.01 else "  (capture is taller than the screen; bottom is cropped by the bezel)"
    print(f"✓ {out_path}  {canvas_w}x{canvas_h}  capture {got:.4f} → screen {want:.4f}{note}")


def main():
    p = argparse.ArgumentParser(description="Compose an App Store screenshot")
    p.add_argument("--size", required=True, choices=sorted(SIZES))
    p.add_argument("--bg", required=True, help="Background hex, e.g. #E77333")
    p.add_argument("--verb", required=True, help="Action verb — the big line")
    p.add_argument("--desc", required=True, help="Benefit descriptor — the second line")
    p.add_argument("--screenshot", required=True)
    p.add_argument("--output", required=True)
    a = p.parse_args()
    compose(a.size, a.bg, a.verb, a.desc, a.screenshot, a.output)


if __name__ == "__main__":
    main()
