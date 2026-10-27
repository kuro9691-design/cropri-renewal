from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"E:\XXX\ホームページ\cropri\画像\カテゴリー\cropri_codex_logo.png")
OUTPUT = ROOT / "emdash-poc" / "public" / "cropri" / "home" / "cropri-header-wordmark.svg"


def contour_path(contour: np.ndarray, offset_x: int, offset_y: int) -> str:
    points = contour.reshape(-1, 2)
    commands = [f"M{points[0, 0] - offset_x} {points[0, 1] - offset_y}"]
    commands.extend(
        f"L{x - offset_x} {y - offset_y}" for x, y in points[1:]
    )
    commands.append("Z")
    return " ".join(commands)


source_bytes = np.fromfile(SOURCE, dtype=np.uint8)
image = cv2.imdecode(source_bytes, cv2.IMREAD_COLOR)
if image is None:
    raise SystemExit(f"Unable to read {SOURCE}")

gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
mask = np.where(gray < 105, 255, 0).astype(np.uint8)
mask = cv2.morphologyEx(
    mask,
    cv2.MORPH_CLOSE,
    cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
)

contours, hierarchy = cv2.findContours(
    mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
)
if hierarchy is None:
    raise SystemExit("No logo contours found")

external = [
    index
    for index, data in enumerate(hierarchy[0])
    if data[3] == -1 and cv2.contourArea(contours[index]) > 200
]

x_values: list[int] = []
y_values: list[int] = []
for index in external:
    x, y, width, height = cv2.boundingRect(contours[index])
    x_values.extend((x, x + width))
    y_values.extend((y, y + height))

left, right = min(x_values), max(x_values)
top, bottom = min(y_values), max(y_values)

parts: list[str] = []
for index in sorted(external, key=lambda item: cv2.boundingRect(contours[item])[0]):
    simplified = cv2.approxPolyDP(contours[index], 0.55, True)
    parts.append(contour_path(simplified, left, top))
    child = hierarchy[0][index][2]
    while child != -1:
        if cv2.contourArea(contours[child]) > 80:
            hole = cv2.approxPolyDP(contours[child], 0.55, True)
            parts.append(contour_path(hole, left, top))
        child = hierarchy[0][child][0]

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {right-left} {bottom-top}" role="img" aria-label="CROPRI">
  <title>CROPRI</title>
  <path fill="#101010" fill-rule="evenodd" d="{' '.join(parts)}"/>
</svg>
'''
OUTPUT.write_text(svg, encoding="utf-8")
print(f"wrote {OUTPUT} ({right-left}x{bottom-top})")
