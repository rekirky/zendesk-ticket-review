#!/usr/bin/env python3
"""Generate simple placeholder PNG icons for the extension."""

import struct
import zlib
import os

def make_png(size, bg_color, text_color):
    """Create a minimal solid-color PNG with a 'Z' mark."""
    width = height = size

    def png_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    signature = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b'IHDR', ihdr_data)

    # Build pixel rows: RGBA
    br, bg, bb = bg_color
    rows = []
    for y in range(height):
        row = b'\x00'  # filter byte
        for x in range(width):
            # Simple 'Z' glyph approximation via diagonal + top + bottom bars
            margin = size // 6
            bar_w = size // 8
            # Top bar
            if margin <= y < margin + bar_w and margin <= x < width - margin:
                row += bytes([text_color[0], text_color[1], text_color[2]])
            # Bottom bar
            elif height - margin - bar_w <= y < height - margin and margin <= x < width - margin:
                row += bytes([text_color[0], text_color[1], text_color[2]])
            # Diagonal
            elif margin + bar_w <= y < height - margin - bar_w:
                # map y to x position of diagonal (top-right to bottom-left)
                ratio = (y - margin - bar_w) / max(1, height - 2 * margin - 2 * bar_w)
                diag_x = (width - margin - 1) - ratio * (width - 2 * margin - 1)
                if abs(x - diag_x) < bar_w:
                    row += bytes([text_color[0], text_color[1], text_color[2]])
                else:
                    row += bytes([br, bg, bb])
            else:
                row += bytes([br, bg, bb])
        rows.append(row)

    raw = b''.join(rows)
    compressed = zlib.compress(raw)
    idat = png_chunk(b'IDAT', compressed)
    iend = png_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend


out_dir = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(out_dir, exist_ok=True)

bg = (31, 115, 183)     # Zendesk blue
fg = (255, 255, 255)    # White

for size in (16, 48, 128):
    data = make_png(size, bg, fg)
    path = os.path.join(out_dir, f"icon{size}.png")
    with open(path, "wb") as f:
        f.write(data)
    print(f"Created {path} ({size}x{size})")
