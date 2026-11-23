# plus: genera el ícono de Anytype Plus (ícono de Anytype con una insignia «+» verde azulado).
# Uso: python3 plus/scripts/icono.py electron/img/icons/1024x1024.png salida.png
import sys
from PIL import Image, ImageDraw, ImageFilter
src, out = sys.argv[1], sys.argv[2]
base = Image.open(src).convert('RGBA')
W = base.size[0]
S = 4  # supersampling
layer = Image.new('RGBA', (W * S, W * S), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
cx, cy, r = int(W * 0.835) * S, int(W * 0.165) * S, int(W * 0.125) * S
# sombra suave
shadow = Image.new('RGBA', layer.size, (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((cx - r, cy - r + 10 * S, cx + r, cy + r + 10 * S), fill=(0, 0, 0, 140))
shadow = shadow.filter(ImageFilter.GaussianBlur(14 * S))
# anillo oscuro (separa la insignia del fondo negro) y círculo verde azulado
ring = int(W * 0.018) * S
d.ellipse((cx - r - ring, cy - r - ring, cx + r + ring, cy + r + ring), fill=(18, 18, 18, 255))
d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(42, 161, 152, 255))
# brillo superior
hl = Image.new('RGBA', layer.size, (0, 0, 0, 0))
ImageDraw.Draw(hl).ellipse((cx - r * 0.82, cy - r * 0.92, cx + r * 0.82, cy + r * 0.15), fill=(255, 255, 255, 40))
# signo +
bar, arm = int(r * 0.24), int(r * 0.56)
d.rounded_rectangle((cx - arm, cy - bar // 2, cx + arm, cy + bar // 2), radius=bar // 2, fill=(255, 255, 255, 255))
d.rounded_rectangle((cx - bar // 2, cy - arm, cx + bar // 2, cy + arm), radius=bar // 2, fill=(255, 255, 255, 255))
badge = Image.alpha_composite(shadow, layer)
badge = Image.alpha_composite(badge, hl)
badge = badge.resize((W, W), Image.LANCZOS)
Image.alpha_composite(base, badge).save(out)
