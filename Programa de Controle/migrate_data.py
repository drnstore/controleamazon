from pathlib import Path
import os
import sqlite3

from server import ROOT, active_value, db, execute, fetchone, is_postgres, json_text, load_json_row, migrate_schema


TABLES = [
    "products",
    "movements",
    "shipments",
    "purchases",
    "dre_records",
    "cash_state",
    "account_entries",
    "account_months",
    "users",
    "audit_logs",
]


def sqlite_columns(connection, table):
    return [row["name"] for row in connection.execute(f"PRAGMA table_info({table})")]


def table_exists(connection, table):
    row = connection.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).fetchone()
    return bool(row)


def pg_exists(connection, table, key_column, key_value):
    return fetchone(connection, f"SELECT 1 FROM {table} WHERE {key_column} = ?", (key_value,)) is not None


def insert_raw(connection, table, row):
    columns = list(row.keys())
    placeholders = ", ".join(["?"] * len(columns))
    column_list = ", ".join(columns)
    execute(connection, f"INSERT INTO {table} ({column_list}) VALUES ({placeholders})", tuple(row.values()))


def normalize_row(table, row):
    data = dict(row)
    if table in ["products", "shipments", "purchases", "dre_records", "account_entries"]:
        data.setdefault("active", active_value(True))
        data.setdefault("deleted_at", None)
    return data


def main():
    if not is_postgres():
        raise SystemExit("Configure DATABASE_URL do PostgreSQL antes de migrar os dados.")

    sqlite_path = Path(os.environ.get("SQLITE_PATH", ROOT / "estoque.db"))
    if not sqlite_path.exists():
        raise SystemExit(f"Banco SQLite nao encontrado: {sqlite_path}")

    sqlite_connection = sqlite3.connect(sqlite_path)
    sqlite_connection.row_factory = sqlite3.Row

    with db() as pg_connection:
        migrate_schema(pg_connection)
        totals = {}
        for table in TABLES:
            if not table_exists(sqlite_connection, table):
                totals[table] = {"migrados": 0, "ignorados": 0}
                continue

            migrated = 0
            skipped = 0
            columns = sqlite_columns(sqlite_connection, table)
            key_column = "month_key" if table == "account_months" else "id"
            for source_row in sqlite_connection.execute(f"SELECT * FROM {table}"):
                row = normalize_row(table, {column: source_row[column] for column in columns})
                key_value = row.get(key_column)
                if not key_value or pg_exists(pg_connection, table, key_column, key_value):
                    skipped += 1
                    continue
                insert_raw(pg_connection, table, row)
                migrated += 1
            totals[table] = {"migrados": migrated, "ignorados": skipped}
        pg_connection.commit()

    print("Migracao concluida.")
    for table, counts in totals.items():
        print(f"{table}: {counts['migrados']} migrados, {counts['ignorados']} ignorados")


if __name__ == "__main__":
    main()
