#!/usr/bin/env python3
"""Build captioned website walkthrough MP4 from captured frames."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess

ROOT = Path(__file__).resolve().parents[1] / "store-assets" / "walkthrough-video"
NORM = ROOT / "normalized"
CAP = ROOT / "captioned"
CLIPS = ROOT / "clips"
OUT = ROOT / "PlayIn432-Website-Walkthrough.mp4"

CAPTIONS = [
    (1, "Play In 432 — your music, retuned to 432"),
    (2, "Three ways to start: files, Spotify match, or playlist import"),
    (3, "Built for listeners who want the truth — private by design"),
    (4, "Free path: A=440 → A=432 · more targets with Lite & Pro"),
    (5, "Live retune · private library · TrueHz Convert HQ export"),
    (6, "Not a fake “stream Spotify in pure 432” app"),
    (7, "Hear the difference — same ratio as the music engine"),
    (8, "Free · Lite $9.99 · Pro $19 — one-time, no account required"),
    (9, "Honest answers: no streaming retune, files stay on device"),
    (10, "Open the player — free 432 listening, no sign-up"),
    (11, "playin432.com — free to listen · no account · TrueHz"),
]

def font_path():
    for p in [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ]:
        if Path(p).exists():
            return p
    raise SystemExit("No Arial font found")

def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, cur = [], []
    for w in words:
        trial = " ".join(cur + [w])
        if draw.textlength(trial, font=font) <= max_width:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    return lines

def add_caption(img, text, font):
    img = img.convert("RGB")
    draw = ImageDraw.Draw(img, "RGBA")
    w, h = img.size
    bar_h = 120
    draw.rectangle([0, h - bar_h, w, h], fill=(7, 11, 15, 220))
    lines = wrap_text(draw, text, font, w - 80)
    line_h = 40
    y = h - bar_h + (bar_h - line_h * len(lines)) // 2
    for line in lines:
        tw = draw.textlength(line, font=font)
        draw.text(((w - tw) / 2, y), line, font=font, fill=(255, 255, 255, 255))
        y += line_h
    return img

def main():
    CAP.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)
    fp = font_path()
    font = ImageFont.truetype(fp, 34)
    font_title = ImageFont.truetype(fp, 64)
    font_sub = ImageFont.truetype(fp, 32)
    files = []

    intro = Image.new("RGB", (1920, 1080), (7, 11, 15))
    d = ImageDraw.Draw(intro)
    t1, t2 = "Play In 432", "Website walkthrough · playin432.com"
    d.text(((1920 - d.textlength(t1, font=font_title)) / 2, 440), t1, font=font_title, fill=(0, 212, 170))
    d.text(((1920 - d.textlength(t2, font=font_sub)) / 2, 530), t2, font=font_sub, fill=(232, 238, 244))
    p = CAP / "00-intro.png"
    intro.save(p)
    files.append((p, 3.0))

    for num, cap in CAPTIONS:
        src = NORM / f"slide-{num:02d}.png"
        if not src.exists():
            print("skip missing", src)
            continue
        out = CAP / f"slide-{num:02d}.png"
        add_caption(Image.open(src), cap, font).save(out)
        files.append((out, 4.0))

    outro = Image.new("RGB", (1920, 1080), (7, 11, 15))
    d = ImageDraw.Draw(outro)
    t1, t2 = "Your music. Retuned to 432.", "playin432.com  ·  Free to listen  ·  No account  ·  TrueHz"
    d.text(((1920 - d.textlength(t1, font=font_title)) / 2, 450), t1, font=font_title, fill=(255, 255, 255))
    d.text(((1920 - d.textlength(t2, font=font_sub)) / 2, 550), t2, font=font_sub, fill=(0, 212, 170))
    p = CAP / "99-outro.png"
    outro.save(p)
    files.append((p, 4.0))

    concat = ROOT / "final_concat.txt"
    with concat.open("w") as f:
        for i, (img, dur) in enumerate(files):
            clip = CLIPS / f"c{i:02d}.mp4"
            cmd = [
                "ffmpeg", "-y", "-loop", "1", "-i", str(img), "-t", str(dur),
                "-vf", f"fade=t=in:st=0:d=0.35,fade=t=out:st={max(0.1, dur-0.45)}:d=0.4",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", str(clip),
            ]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode:
                raise SystemExit(r.stderr[-500:])
            f.write(f"file 'clips/c{i:02d}.mp4'\n")
    r = subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(OUT)], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-500:])
    print("Wrote", OUT, OUT.stat().st_size, "bytes")

if __name__ == "__main__":
    main()
