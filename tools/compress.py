#!/usr/bin/env python3
"""tools/compress.py — shrink dossier PNGs to <= 256 KiB without changing content.
Re-encodes as a 256-colour palette PNG (median-cut, Floyd-Steinberg dither),
the same class of transform pngquant performs: pixels keep their positions and
colours, only the palette is reduced. Usage: python3 tools/compress.py <png...>
Only rewrites a file when it is over the cap and the result is smaller.
"""
import os
import sys

MAX_BYTES = 262144

def main(paths):
    from PIL import Image
    for path in paths:
        size = os.path.getsize(path)
        if size <= MAX_BYTES:
            print(f"{path}: {size} bytes — already under cap, untouched")
            continue
        im = Image.open(path)
        # Palette-quantize: 256 colours, dithered. Try a couple of settings,
        # keep the smallest that stays under the cap.
        best = None
        for colors in (256, 224, 192, 160):
            q = im.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
            tmp = path + ".tmp.png"
            q.save(tmp, optimize=True)
            s = os.path.getsize(tmp)
            if best is None or s < best[1]:
                best = (tmp, s)
            if s <= MAX_BYTES:
                break
        tmp, s = best
        if s < size:
            os.replace(tmp, path)
            print(f"{path}: {size} -> {s} bytes")
        else:
            os.remove(tmp)
            print(f"{path}: {size} bytes — quantize did not help (smallest {s}), left as-is")

if __name__ == "__main__":
    main(sys.argv[1:])
