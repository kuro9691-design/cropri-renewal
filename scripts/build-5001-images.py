"""Build local delivery images from the licensed United Athle 500101 files.

Requires Pillow. The source JPEGs remain unchanged. No stock or price columns
are copied into the WordPress plugin.
"""

import csv
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STOCK = ROOT / "data/united-athle-stock/stock_all_latest.csv"
SOURCE = ROOT / "assets/united-athle/5001/product/pic-500101"
OUTPUT = ROOT / "wordpress-plugin/cropri-estimator/assets/5001-images"

with STOCK.open("r", encoding="cp932", newline="") as handle:
    codes = sorted({row["カラーコード"] for row in csv.DictReader(handle) if row["商品コード"] == "500101"})

if len(codes) != 61:
    raise SystemExit(f"Expected 61 distinct colors, found {len(codes)}")

for code in codes:
    source = SOURCE / f"500101-{code}-03-front_2000.jpg"
    if not source.is_file():
        raise SystemExit(f"Missing licensed photo: {source.name}")
    with Image.open(source) as original:
        for kind, pixels, quality in (("thumb", 220, 80), ("view", 1000, 82)):
            folder = OUTPUT / kind
            folder.mkdir(parents=True, exist_ok=True)
            image = original.copy()
            image.thumbnail((pixels, pixels), Image.Resampling.LANCZOS)
            image.save(folder / f"{code}.jpg", format="JPEG", quality=quality, optimize=True, progressive=True)

back_source = SOURCE / "500101-0002-03-back_2000.jpg"
if not back_source.is_file():
    raise SystemExit(f"Missing licensed back photo: {back_source.name}")
with Image.open(back_source) as original:
    folder = OUTPUT / "back"
    folder.mkdir(parents=True, exist_ok=True)
    image = original.copy()
    image.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
    image.save(folder / "0002.jpg", format="JPEG", quality=82, optimize=True, progressive=True)

print(f"Built {len(codes)} thumb/view pairs and one black back reference in {OUTPUT}")
