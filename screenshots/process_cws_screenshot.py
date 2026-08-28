from PIL import Image, ImageDraw, ImageFilter
import os

img_path = r"s:\02_PROJECTS_CODE\code projects mine\uopeople-brightspace-course-export\screenshots\Screenshot 2026-08-27 013312.png"
out_dir = r"s:\02_PROJECTS_CODE\code projects mine\uopeople-brightspace-course-export\screenshots"

img = Image.open(img_path).convert("RGBA")
target_w, target_h = 1280, 800

# Create a sleek modern dark gradient background
canvas = Image.new("RGB", (target_w, target_h), (10, 15, 29))
draw = ImageDraw.Draw(canvas)

# Create subtle radial / vertical gradient
for y in range(target_h):
    # Gradient from dark navy/slate (#0f172a) to deep midnight (#060813)
    r = int(15 - (y / target_h) * 8)
    g = int(23 - (y / target_h) * 14)
    b = int(42 - (y / target_h) * 26)
    draw.line([(0, y), (target_w, y)], fill=(r, g, b))

# Add a subtle radial accent glow in center
glow = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)
glow_center = (target_w // 2, target_h // 2)
for radius in range(350, 0, -10):
    alpha = int((1 - radius / 350) * 35)
    glow_draw.ellipse(
        [
            glow_center[0] - radius * 1.5,
            glow_center[1] - radius,
            glow_center[0] + radius * 1.5,
            glow_center[1] + radius,
        ],
        fill=(59, 130, 246, alpha),
    )

canvas.paste(glow, (0, 0), glow)

# Popup sizing & drop shadow
# Popup original size is (541, 774).
# We want it to fit comfortably with padding in 800 height (e.g., height ~ 720)
target_popup_h = 700
scale = target_popup_h / img.height
target_popup_w = int(img.width * scale)

popup_resized = img.resize((target_popup_w, target_popup_h), Image.Resampling.LANCZOS)

# Create soft drop shadow
shadow = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
shadow_draw = ImageDraw.Draw(shadow)

pos_x = (target_w - target_popup_w) // 2
pos_y = (target_h - target_popup_h) // 2

# Draw shadow rectangle with blur
shadow_offset_y = 12
shadow_blur = 30
shadow_rect = [
    pos_x - 10,
    pos_y + shadow_offset_y,
    pos_x + target_popup_w + 10,
    pos_y + target_popup_h + shadow_offset_y + 10,
]
shadow_draw.rounded_rectangle(shadow_rect, radius=20, fill=(0, 0, 0, 160))
shadow = shadow.filter(ImageFilter.GaussianBlur(shadow_blur))

# Composite shadow onto canvas
canvas.paste(shadow, (0, 0), shadow)

# Paste popup
canvas.paste(popup_resized, (pos_x, pos_y), popup_resized)

# Save final 1280x800 PNG (Strict RGB, no alpha)
out_1280 = os.path.join(out_dir, "cws_screenshot_1280x800.png")
canvas.save(out_1280, format="PNG", optimize=True)
print(f"Generated 1280x800 screenshot: {out_1280}")

# Save 640x400 PNG
out_640 = os.path.join(out_dir, "cws_screenshot_640x400.png")
img_640 = canvas.resize((640, 400), Image.Resampling.LANCZOS)
img_640.save(out_640, format="PNG", optimize=True)
print(f"Generated 640x400 screenshot: {out_640}")

# Also generate 440x280 Small Promo Tile if needed
out_440 = os.path.join(out_dir, "cws_small_promo_440x280.png")
img_440 = canvas.resize((440, 280), Image.Resampling.LANCZOS)
img_440.save(out_440, format="PNG", optimize=True)
print(f"Generated 440x280 Small Promo Tile: {out_440}")
