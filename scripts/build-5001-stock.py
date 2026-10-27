"""Export only public 5001-01 stock counts from the licensed CP932 CSV.

Run after replacing stock_all_latest.csv, then rebuild the estimator ZIP.
This intentionally refuses duplicate color/size rows and mixed timestamps.
No price, JAN, cost, arrival date, or source row is copied to the plugin.
"""

import csv
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/united-athle-stock/stock_all_latest.csv"
OUTPUT = ROOT / "wordpress-plugin/cropri-estimator/assets/stock-5001.json"
SIZES = ("S", "M", "L", "XL", "XXL", "XXXL")
PRODUCT = "500101"

with SOURCE.open("r", encoding="cp932", newline="") as handle:
    rows = [row for row in csv.DictReader(handle) if row["商品コード"] == PRODUCT and row["サイズ名"] in SIZES]

counts = {}
timestamps = set()
for row in rows:
    code = row["カラーコード"]
    size = row["サイズ名"]
    if not (len(code) == 4 and code.isascii() and code.isdigit()):
        raise SystemExit(f"Invalid color code: {code!r}")
    if size in counts.setdefault(code, {}):
        raise SystemExit(f"Duplicate stock row: {code}/{size}; no automatic sum")
    raw_count = row["在庫数"].replace(",", "")
    if not raw_count.isascii() or not raw_count.isdigit():
        raise SystemExit(f"Invalid stock count: {code}/{size}")
    counts[code][size] = int(raw_count)
    timestamps.add(row["作成日時"])

if len(counts) != 61 or len(rows) != 366 or any(set(values) != set(SIZES) for values in counts.values()):
    raise SystemExit("Expected exactly 61 colors with one row for each of 6 sizes")
if len(timestamps) != 1:
    raise SystemExit("Mixed CSV creation timestamps; review before publishing")
created = datetime.strptime(timestamps.pop(), "%Y/%m/%d %H:%M:%S")
public = {
    "source_created_at": created.strftime("%Y/%m/%d %H:%M:%S"),
    "stock": {code: {size: counts[code][size] for size in SIZES} for code in sorted(counts)},
}
OUTPUT.write_text(json.dumps(public, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Exported {len(counts)} colors × {len(SIZES)} sizes, CSV created {public['source_created_at']}")
