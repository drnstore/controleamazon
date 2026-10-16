import csv
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from amazon_csv import ALIASES, INVALID, parse_report
import server


def report(rows, english=False, delimiter=","):
    out = io.StringIO()
    writer = csv.writer(out, delimiter=delimiter)
    writer.writerow(["Monthly unified transaction report"])
    writer.writerow([aliases[-1] if english else aliases[0] for aliases in ALIASES.values()])
    for row in rows:
        values = {"date": "1 de set. de 2026 10:00:00 GMT-7", "type": "Pedido", "sku": "ABC",
                  "description": "Produto", "quantity": "1", "sales": "100", "total": "85", "selling": "-10", "fba": "-5"}
        values.update(row)
        writer.writerow([values.get(key, "0") for key in ALIASES])
    return out.getvalue()


class ParserTests(unittest.TestCase):
    def test_real_report_when_available(self):
        path = os.environ.get("AMAZON_TEST_CSV")
        if not path:
            self.skipTest("Private report supplied through AMAZON_TEST_CSV only")
        data = parse_report(Path(path).read_text(encoding="utf-8-sig"), Path(path).name)
        expected_path = os.environ.get("AMAZON_TEST_EXPECTED")
        if expected_path:
            expected = json.loads(Path(expected_path).read_text(encoding="utf-8-sig"))
            for key, value in expected.items():
                self.assertEqual(data[key], value, key)
        self.assertGreater(data["transactions"], 0)
        signed = sum(line["cents"] * (1 if line["side"] == "income" else -1) for line in data["lines"])
        self.assertEqual(signed, data["beforeCogs"])

    def test_net_charges_and_cogs_quantities(self):
        text = report([{}, {"type": "Reembolso", "sales": "-30", "selling": "3", "fba": "1", "total": "-26"},
            {"type": "Ajuste", "description": "Reembolso de Estoque FBA - Perdido", "total": "20"},
            {"type": "Ajuste", "description": "Reembolso de Estoque FBA - Ajuste geral", "total": "-8"},
            {"type": "Taxa de serviço", "description": "Custo de Publicidade", "total": "-12"}])
        p = parse_report(text, "sample.csv")
        self.assertEqual(p["totals"]["selling"], 700)
        self.assertEqual(p["totals"]["fba"], 400)
        self.assertEqual(p["totals"]["inventory"], 1200)
        self.assertEqual(p["totals"]["refunds"], 3000)
        self.assertEqual(p["totals"]["ads"], 1200)
        self.assertEqual(p["skuUnits"][0]["net"], 0)
        self.assertEqual(p["breakdown"]["selling"], {"charges": 1000, "credits": 300})

    def test_unknown_excluded_and_transfer_visible(self):
        p = parse_report(report([{"type": "New fee", "total": "-123,45"}, {"type": "Transferir", "total": "-80"}]), "x.csv")
        self.assertEqual(p["beforeCogs"], 0)
        self.assertEqual(p["unknown"][0]["total"], -12345)
        self.assertEqual(len(p["transfers"]), 1)

    def test_timezone_not_utc_or_naive_month(self):
        p = parse_report(report([{"date": "31 de ago. de 2026 20:41:13 GMT-7"}]), "x.csv", "2026-09")
        self.assertEqual(p["month"], "2026-09")
        p = parse_report(report([{"date": "30 de set. de 2026 18:41:13 GMT-7"}]), "x.csv")
        self.assertEqual(p["month"], "2026-09")
        with self.assertRaises(ValueError):
            parse_report(report([{}]), "x.csv", "2026-10")
        with self.assertRaises(ValueError):
            parse_report(report([{}, {"date": "1 de out. de 2026 10:00:00 GMT-7"}]), "x.csv")

    def test_english_and_decimal_precision(self):
        p = parse_report(report([{"date": "Sep 1, 2026 10:00:00 AM PDT", "type": "Order", "sales": "1,234.56", "selling": "-0.10", "fba": "-0.20", "total": "1234.26"}], english=True), "x.csv")
        self.assertEqual(p["totals"]["gross"], 123456)
        self.assertEqual(p["beforeCogs"], 123426)
        p = parse_report(report([{"sales": "1.234,56", "total": "1.219,56"}], delimiter=";"), "x.csv")
        self.assertEqual(p["totals"]["gross"], 123456)

    def test_invalid_input(self):
        for text in ["hello", "", "sku,total\nABC,12"]:
            with self.assertRaisesRegex(ValueError, INVALID):
                parse_report(text, "x.csv")
        for value in ["NaN", "Infinity", "1,234", "not money"]:
            with self.assertRaises(ValueError):
                parse_report(report([{"sales": value}]), "x.csv")


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.patch_db = patch.object(server, "DB_PATH", Path(self.temp.name) / "isolated.db")
        self.patch_url = patch.object(server, "DATABASE_URL", "")
        self.patch_db.start()
        self.patch_url.start()
        self.conn = server.db()
        self.original = {"id": "original", "month": "2026-09", "monthKey": "2026-09", "revenue": 90,
            "incomes": [{"id": "net", "label": "Liquido marketplace", "value": 85}],
            "expenses": [{"id": "tax", "label": "Imposto DAS", "value": 12}, {"id": "cmv", "label": "Custo de produtos", "value": 20}], "notes": "preserve me"}
        server.save_dre(self.conn, self.original)
        server.save_dre(self.conn, {**self.original, "id": "old", "month": "2026-08", "monthKey": "2026-08"})
        self.conn.execute("INSERT INTO products (id,data) VALUES (?,?)", ("product", json.dumps({"id":"product", "sku":"ABC", "warehouseStock":2,"fbaStock":1,"batches":[{"remainingQty":3,"unitCost":5}]})))
        self.conn.commit()
        self.before = self.snapshot()
        self.payload = {"content": report([{}]), "file": "sample.csv", "month": "2026-09"}

    def tearDown(self):
        self.conn.close()
        self.patch_db.stop()
        self.patch_url.stop()
        self.temp.cleanup()

    def snapshot(self):
        tables = [row[0] for row in self.conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name != 'amazon_dre_imports'")]
        return {t: [tuple(row) for row in self.conn.execute(f'SELECT * FROM "{t}" ORDER BY 1')] for t in tables}

    def confirm(self, reimport=False):
        p = server.amazon_preview(self.conn, self.payload)
        saved = server.confirm_amazon_import(self.conn, {**self.payload, "token": p["token"], "reimport": reimport, "excludedManual": ["incomes:net"]}, {"id": "test"})
        self.conn.commit()
        return saved

    def test_preview_no_writes_and_import_preserves_every_table(self):
        p = server.amazon_preview(self.conn, self.payload)
        self.assertEqual(p["costReferences"]["ABC"], 5)
        self.assertEqual(self.snapshot(), self.before)
        self.assertEqual(server.amazon_imports(self.conn), [])
        saved = self.confirm()
        self.assertEqual(saved["source"], "amazon_csv")
        self.assertEqual(self.snapshot(), self.before)
        self.assertEqual(len(server.amazon_imports(self.conn)), 1)

    def test_duplicate_rejected_reimport_versioned_no_manual_changes(self):
        self.confirm()
        with self.assertRaisesRegex(ValueError, "Reimportar"):
            self.confirm()
        self.conn.rollback()
        self.payload["content"] = report([{"sales": "200", "total": "185"}])
        saved = self.confirm(reimport=True)
        self.assertEqual(saved["revision"], 2)
        self.assertEqual(len(server.amazon_imports(self.conn)), 1)
        self.assertEqual(server.amazon_imports(self.conn)[0]["totals"]["gross"], 20000)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM amazon_dre_imports").fetchone()[0], 2)
        self.assertEqual(self.snapshot(), self.before)

    def test_stale_preview_and_tampering_rejected(self):
        p = server.amazon_preview(self.conn, self.payload)
        self.payload["content"] = report([{"sales": "200", "total": "185"}])
        with self.assertRaisesRegex(ValueError, "mudaram"):
            server.confirm_amazon_import(self.conn, {**self.payload, "token": p["token"]}, {"id":"test"})
        self.conn.rollback()
        self.assertEqual(server.amazon_imports(self.conn), [])
        self.assertEqual(self.snapshot(), self.before)

    def test_invalid_and_unknown_no_legacy_writes(self):
        with self.assertRaises(ValueError):
            server.amazon_preview(self.conn, {"content": "bad", "file": "bad.csv"})
        self.payload["content"] = report([{"type":"New type", "total":"50"}])
        p = server.amazon_preview(self.conn, self.payload)
        self.assertEqual(len(p["report"]["unknown"]), 1)
        self.assertEqual(self.snapshot(), self.before)

    def test_closed_month_and_permissions(self):
        server.save_dre(self.conn, {**self.original, "closed": True})
        self.conn.commit()
        with self.assertRaisesRegex(ValueError, "fechado"):
            server.amazon_preview(self.conn, self.payload)
        self.assertEqual(server.post_permission("/api/dre/amazon/confirm"), "dre:write")


if __name__ == "__main__":
    unittest.main()
