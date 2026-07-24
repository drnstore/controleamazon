import base64
import io
import json
import sqlite3
from pathlib import Path

from PIL import Image


DB_PATH = Path(__file__).resolve().parent / "estoque.db"
MAX_SIZE = 360
QUALITY = 76


def compact_data_url(data_url):
    if not isinstance(data_url, str) or not data_url.startswith("data:image/"):
        return data_url, False
    header, raw = data_url.split(",", 1)
    original_size = len(raw)
    image_bytes = base64.b64decode(raw)
    with Image.open(io.BytesIO(image_bytes)) as image:
      image = image.convert("RGB")
      image.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)
      output = io.BytesIO()
      image.save(output, format="JPEG", quality=QUALITY, optimize=True)
    compacted = "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")
    return compacted, len(compacted) < original_size


def main():
    connection = sqlite3.connect(DB_PATH)
    rows = connection.execute("SELECT id, data FROM products").fetchall()
    changed = 0
    for product_id, raw_data in rows:
        product = json.loads(raw_data)
        compacted, did_change = compact_data_url(product.get("photoData"))
        if did_change:
            product["photoData"] = compacted
            connection.execute(
                "UPDATE products SET data = ? WHERE id = ?",
                (json.dumps(product, ensure_ascii=False), product_id),
            )
            changed += 1
    connection.commit()
    print(f"fotos compactadas: {changed}")


if __name__ == "__main__":
    main()
