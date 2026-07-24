from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import sys
import time
import uuid


ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
DB_PATH = ROOT / "estoque.db"
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
NODE_ENV = os.environ.get("NODE_ENV", os.environ.get("APP_ENV", "development")).lower()
REQUIRE_AUTH = os.environ.get("REQUIRE_AUTH", "").strip().lower() in {"1", "true", "yes", "sim"}
SESSION_COOKIE = "controle_session"
SESSION_MAX_AGE = 60 * 60 * 12
ROLE_PERMISSIONS = {
    "admin": {"*"},
    "estoque": {
        "read",
        "products:write",
        "products:delete",
        "stock:write",
        "shipments:write",
        "shipments:delete",
    },
    "compras": {"read", "products:write", "purchases:write", "purchases:delete"},
    "financeiro": {"read", "dre:write", "dre:delete", "cash:write", "account:write", "account:delete"},
    "consulta": {"read"},
}


def load_dotenv():
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()


def is_postgres():
    return bool(DATABASE_URL)


def session_secret():
    secret = os.environ.get("SESSION_SECRET", "").strip()
    if secret:
        return secret.encode("utf-8")
    if NODE_ENV == "production" or is_postgres():
        raise RuntimeError("Configure SESSION_SECRET antes de iniciar em producao.")
    return b"local-development-secret-change-me"


def auth_required():
    return REQUIRE_AUTH or NODE_ENV == "production" or is_postgres()


def local_user():
    return {
        "id": "local",
        "email": "local",
        "name": "Local",
        "role": "admin",
    }


def now_ms():
    return int(time.time() * 1000)


def json_text(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def import_psycopg():
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:
        raise RuntimeError("Instale as dependencias com: pip install -r requirements.txt") from exc
    return psycopg, dict_row


def translate_sql(sql):
    if is_postgres():
        return sql.replace("?", "%s")
    return sql


def db():
    if is_postgres():
        psycopg, dict_row = import_psycopg()
        connection = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    else:
        connection = sqlite3.connect(DB_PATH)
        connection.row_factory = sqlite3.Row
    migrate_schema(connection)
    return connection


def execute(connection, sql, params=()):
    return connection.execute(translate_sql(sql), params)


def fetchone(connection, sql, params=()):
    return execute(connection, sql, params).fetchone()


def fetchall(connection, sql, params=()):
    return execute(connection, sql, params).fetchall()


def row_value(row, key):
    return row[key]


def upsert_sql(table, columns, conflict_column):
    placeholders = ", ".join(["?"] * len(columns))
    column_list = ", ".join(columns)
    if is_postgres():
        updates = ", ".join([f"{column} = EXCLUDED.{column}" for column in columns if column != conflict_column])
        return f"INSERT INTO {table} ({column_list}) VALUES ({placeholders}) ON CONFLICT ({conflict_column}) DO UPDATE SET {updates}"
    return f"INSERT OR REPLACE INTO {table} ({column_list}) VALUES ({placeholders})"


def upsert_row(connection, table, columns, values, conflict_column="id"):
    execute(connection, upsert_sql(table, columns, conflict_column), values)


def migrate_schema(connection):
    if is_postgres():
        statements = [
            """
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                deleted_at BIGINT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS movements (
                id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                data TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS shipments (
                id TEXT PRIMARY KEY,
                schedule_id TEXT NOT NULL UNIQUE,
                schedule_date TEXT NOT NULL,
                schedule_time TEXT NOT NULL,
                data TEXT NOT NULL,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                deleted_at BIGINT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS purchases (
                id TEXT PRIMARY KEY,
                order_number TEXT NOT NULL UNIQUE,
                product_id TEXT NOT NULL,
                supplier_key TEXT NOT NULL,
                status TEXT NOT NULL,
                data TEXT NOT NULL,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                deleted_at BIGINT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS dre_records (
                id TEXT PRIMARY KEY,
                month_key TEXT NOT NULL UNIQUE,
                data TEXT NOT NULL,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                deleted_at BIGINT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS cash_state (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS account_entries (
                id TEXT PRIMARY KEY,
                entry_date TEXT NOT NULL,
                month_key TEXT NOT NULL,
                entry_type TEXT NOT NULL,
                data TEXT NOT NULL,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                deleted_at BIGINT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS account_months (
                month_key TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                user_email TEXT,
                action TEXT NOT NULL,
                entity TEXT NOT NULL,
                record_id TEXT,
                old_data TEXT,
                new_data TEXT,
                quantity REAL,
                note TEXT,
                created_at BIGINT NOT NULL
            )
            """,
        ]
    else:
        statements = [
            "CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER)",
            "CREATE TABLE IF NOT EXISTS movements (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, created_at INTEGER NOT NULL, data TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS shipments (id TEXT PRIMARY KEY, schedule_id TEXT NOT NULL UNIQUE, schedule_date TEXT NOT NULL, schedule_time TEXT NOT NULL, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER)",
            "CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, product_id TEXT NOT NULL, supplier_key TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER)",
            "CREATE TABLE IF NOT EXISTS dre_records (id TEXT PRIMARY KEY, month_key TEXT NOT NULL UNIQUE, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER)",
            "CREATE TABLE IF NOT EXISTS cash_state (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS account_entries (id TEXT PRIMARY KEY, entry_date TEXT NOT NULL, month_key TEXT NOT NULL, entry_type TEXT NOT NULL, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER)",
            "CREATE TABLE IF NOT EXISTS account_months (month_key TEXT PRIMARY KEY, data TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
            "CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, user_id TEXT, user_email TEXT, action TEXT NOT NULL, entity TEXT NOT NULL, record_id TEXT, old_data TEXT, new_data TEXT, quantity REAL, note TEXT, created_at INTEGER NOT NULL)",
        ]
    for statement in statements:
        connection.execute(statement)
    add_missing_columns(connection)
    connection.commit()


def add_missing_columns(connection):
    for table in ["products", "shipments", "purchases", "dre_records", "account_entries"]:
        ensure_column(connection, table, "active", "BOOLEAN NOT NULL DEFAULT TRUE" if is_postgres() else "INTEGER NOT NULL DEFAULT 1")
        ensure_column(connection, table, "deleted_at", "BIGINT" if is_postgres() else "INTEGER")


def ensure_column(connection, table, column, definition):
    if is_postgres():
        exists = fetchone(
            connection,
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = ? AND column_name = ?
            """,
            (table, column),
        )
    else:
        exists = any(row_value(row, "name") == column for row in fetchall(connection, f"PRAGMA table_info({table})"))
    if not exists:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def read_json(handler):
    length = int(handler.headers.get("content-length", "0"))
    if length <= 0:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def write_json(handler, status, payload, extra_headers=None):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    if extra_headers:
        for key, value in extra_headers.items():
            handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(body)


def public_error(error):
    if NODE_ENV == "production":
        return "Nao foi possivel concluir a operacao."
    return str(error)


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 220_000)
    return f"pbkdf2_sha256$220000${salt}${base64.b64encode(digest).decode('ascii')}"


def verify_password(password, stored_hash):
    try:
        algorithm, iterations, salt, encoded_digest = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
        return hmac.compare_digest(base64.b64encode(digest).decode("ascii"), encoded_digest)
    except Exception:
        return False


def normalize_email(email):
    return str(email or "").strip().lower()


def create_session_token(user):
    payload = {
        "uid": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": int(time.time()) + SESSION_MAX_AGE,
    }
    payload_raw = base64.urlsafe_b64encode(json_text(payload).encode("utf-8")).decode("ascii").rstrip("=")
    signature = hmac.new(session_secret(), payload_raw.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{payload_raw}.{signature}"


def decode_session_token(token):
    if not token or "." not in token:
        return None
    payload_raw, signature = token.rsplit(".", 1)
    expected = hmac.new(session_secret(), payload_raw.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    padded = payload_raw + "=" * (-len(payload_raw) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def cookie_header(token):
    secure = "; Secure" if NODE_ENV == "production" else ""
    return f"{SESSION_COOKIE}={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={SESSION_MAX_AGE}{secure}"


def clear_cookie_header():
    secure = "; Secure" if NODE_ENV == "production" else ""
    return f"{SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0{secure}"


def get_cookie_token(handler):
    raw_cookie = handler.headers.get("Cookie", "")
    parsed = cookies.SimpleCookie()
    parsed.load(raw_cookie)
    morsel = parsed.get(SESSION_COOKIE)
    return morsel.value if morsel else ""


def user_from_request(handler, connection):
    if not auth_required():
        return local_user()
    payload = decode_session_token(get_cookie_token(handler))
    if not payload:
        return None
    row = fetchone(connection, "SELECT * FROM users WHERE id = ? AND active = ?", (payload.get("uid"), active_value(True)))
    return dict(row) if row else None


def active_value(value):
    if is_postgres():
        return bool(value)
    return 1 if value else 0


def has_permission(user, permission):
    if not user:
        return False
    permissions = ROLE_PERMISSIONS.get(user.get("role"), set())
    return "*" in permissions or permission in permissions


def require_user(handler, connection, permission="read"):
    user = user_from_request(handler, connection)
    if not user:
        write_json(handler, 401, {"error": "Faça login para acessar o sistema."})
        return None
    if not has_permission(user, permission):
        write_json(handler, 403, {"error": "Seu usuario nao tem permissao para esta acao."})
        return None
    return user


def safe_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    }


def audit(connection, user, action, entity, record_id=None, old_data=None, new_data=None, quantity=None, note=""):
    row = {
        "id": str(uuid.uuid4()),
        "user_id": user.get("id") if user else None,
        "user_email": user.get("email") if user else None,
        "action": action,
        "entity": entity,
        "record_id": record_id,
        "old_data": json_text(old_data) if old_data is not None else None,
        "new_data": json_text(new_data) if new_data is not None else None,
        "quantity": quantity,
        "note": note,
        "created_at": now_ms(),
    }
    upsert_row(
        connection,
        "audit_logs",
        ["id", "user_id", "user_email", "action", "entity", "record_id", "old_data", "new_data", "quantity", "note", "created_at"],
        tuple(row.values()),
    )


def load_json_row(row):
    return json.loads(row_value(row, "data"))


def select_active_json(connection, table, order_by="id"):
    rows = fetchall(connection, f"SELECT data FROM {table} WHERE active = ? ORDER BY {order_by}", (active_value(True),))
    return [load_json_row(row) for row in rows]


def get_json_by_id(connection, table, record_id):
    row = fetchone(connection, f"SELECT data FROM {table} WHERE id = ?", (record_id,))
    return load_json_row(row) if row else None


def validate_product(product):
    if int(product.get("warehouseStock", 0)) < 0 or int(product.get("fbaStock", 0)) < 0:
        raise ValueError("Estoque nao pode ficar negativo.")
    for batch in product.get("batches", []) or []:
        if float(batch.get("remainingQty", 0)) < 0 or float(batch.get("unitCost", 0)) < 0:
            raise ValueError("Lote nao pode ter quantidade ou custo negativo.")


def save_product(connection, product):
    validate_product(product)
    upsert_row(connection, "products", ["id", "data", "active", "deleted_at"], (product["id"], json_text(product), active_value(True), None))


def save_movement(connection, movement):
    upsert_row(
        connection,
        "movements",
        ["id", "product_id", "created_at", "data"],
        (movement["id"], movement.get("productId", ""), int(movement.get("createdAt", now_ms())), json_text(movement)),
    )


def save_purchase(connection, purchase):
    upsert_row(
        connection,
        "purchases",
        ["id", "order_number", "product_id", "supplier_key", "status", "data", "active", "deleted_at"],
        (
            purchase["id"],
            purchase.get("orderNumber") or purchase["id"],
            purchase.get("productId", ""),
            purchase.get("supplierKey", ""),
            purchase.get("status", ""),
            json_text(purchase),
            active_value(True),
            None,
        ),
    )


def save_shipment(connection, shipment):
    upsert_row(
        connection,
        "shipments",
        ["id", "schedule_id", "schedule_date", "schedule_time", "data", "active", "deleted_at"],
        (
            shipment["id"],
            shipment.get("scheduleId", ""),
            shipment.get("date", ""),
            shipment.get("time", ""),
            json_text(shipment),
            active_value(True),
            None,
        ),
    )


def save_dre(connection, record):
    upsert_row(
        connection,
        "dre_records",
        ["id", "month_key", "data", "active", "deleted_at"],
        (record["id"], record.get("monthKey", ""), json_text(record), active_value(True), None),
    )


def save_account_entry(connection, entry):
    upsert_row(
        connection,
        "account_entries",
        ["id", "entry_date", "month_key", "entry_type", "data", "active", "deleted_at"],
        (
            entry["id"],
            entry.get("date", ""),
            entry.get("monthKey", ""),
            entry.get("type", ""),
            json_text(entry),
            active_value(True),
            None,
        ),
    )


def save_account_month(connection, month_state):
    upsert_row(
        connection,
        "account_months",
        ["month_key", "data"],
        (month_state.get("monthKey", ""), json_text(month_state)),
        conflict_column="month_key",
    )


def soft_delete(connection, table, record_id):
    old_data = get_json_by_id(connection, table, record_id)
    if not old_data:
        return None
    old_data["active"] = False
    old_data["deletedAt"] = now_ms()
    execute(
        connection,
        f"UPDATE {table} SET active = ?, deleted_at = ?, data = ? WHERE id = ?",
        (active_value(False), old_data["deletedAt"], json_text(old_data), record_id),
    )
    return old_data


def users_count(connection):
    row = fetchone(connection, "SELECT COUNT(*) AS total FROM users")
    return int(row_value(row, "total"))


def handle_login(handler):
    if not auth_required():
        write_json(handler, 200, {"ok": True, "user": safe_user(local_user()), "authRequired": False})
        return

    payload = read_json(handler)
    email = normalize_email(payload.get("email"))
    password = str(payload.get("password") or "")
    with db() as connection:
        row = fetchone(connection, "SELECT * FROM users WHERE email = ? AND active = ?", (email, active_value(True)))
        if not row or not verify_password(password, row["password_hash"]):
            write_json(handler, 401, {"error": "Email ou senha invalidos."})
            return
        user = dict(row)
        audit(connection, user, "login", "users", user["id"], note="Login realizado")
        connection.commit()
        write_json(handler, 200, {"ok": True, "user": safe_user(user)}, {"Set-Cookie": cookie_header(create_session_token(user))})


def handle_logout(handler):
    if not auth_required():
        write_json(handler, 200, {"ok": True, "authRequired": False})
        return

    with db() as connection:
        user = user_from_request(handler, connection)
        if user:
            audit(connection, user, "logout", "users", user["id"], note="Logout realizado")
            connection.commit()
    write_json(handler, 200, {"ok": True}, {"Set-Cookie": clear_cookie_header()})


def handle_me(handler):
    if not auth_required():
        write_json(handler, 200, {"user": safe_user(local_user()), "authRequired": False})
        return

    with db() as connection:
        user = user_from_request(handler, connection)
        if not user:
            write_json(handler, 401, {"error": "Faça login para acessar o sistema."})
            return
        write_json(handler, 200, {"user": safe_user(user)})


def handle_users(handler):
    with db() as connection:
        user = require_user(handler, connection, "users:write")
        if not user:
            return
        if handler.command == "GET":
            rows = fetchall(connection, "SELECT id, email, name, role, active, created_at, updated_at FROM users ORDER BY email")
            write_json(handler, 200, {"users": [dict(row) for row in rows]})
            return
        payload = read_json(handler)
        role = payload.get("role", "consulta")
        if role not in ROLE_PERMISSIONS:
            write_json(handler, 400, {"error": "Perfil de usuario invalido."})
            return
        password = str(payload.get("password") or "")
        if len(password) < 8:
            write_json(handler, 400, {"error": "A senha precisa ter pelo menos 8 caracteres."})
            return
        new_user = {
            "id": str(uuid.uuid4()),
            "email": normalize_email(payload.get("email")),
            "name": str(payload.get("name") or payload.get("email") or "").strip(),
            "role": role,
            "password_hash": hash_password(password),
            "active": active_value(True),
            "created_at": now_ms(),
            "updated_at": now_ms(),
        }
        upsert_row(
            connection,
            "users",
            ["id", "email", "name", "role", "password_hash", "active", "created_at", "updated_at"],
            tuple(new_user.values()),
        )
        audit(connection, user, "create", "users", new_user["id"], new_data=safe_user(new_user))
        connection.commit()
        write_json(handler, 200, {"ok": True, "user": safe_user(new_user)})


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path in ["/health", "/api/health"]:
                with db() as connection:
                    fetchone(connection, "SELECT 1 AS ok")
                write_json(self, 200, {"status": "ok", "database": "ok"})
                return
            if path == "/api/auth/me":
                handle_me(self)
                return
            if path == "/api/users":
                handle_users(self)
                return
            if path == "/api/data":
                with db() as connection:
                    user = require_user(self, connection, "read")
                    if not user:
                        return
                    cash_row = fetchone(connection, "SELECT data FROM cash_state WHERE id = 'main'")
                    cash_state = load_json_row(cash_row) if cash_row else {
                        "id": "main",
                        "accountValue": 0,
                        "amazonReceivable": 0,
                        "updatedAt": 0,
                    }
                    write_json(
                        self,
                        200,
                        {
                            "products": select_active_json(connection, "products", "id"),
                            "movements": [load_json_row(row) for row in fetchall(connection, "SELECT data FROM movements ORDER BY created_at DESC")],
                            "shipments": select_active_json(connection, "shipments", "schedule_date, schedule_time"),
                            "purchases": select_active_json(connection, "purchases", "id DESC"),
                            "dreRecords": select_active_json(connection, "dre_records", "month_key DESC"),
                            "cashState": cash_state,
                            "accountEntries": select_active_json(connection, "account_entries", "entry_date DESC, id DESC"),
                            "accountMonths": [load_json_row(row) for row in fetchall(connection, "SELECT data FROM account_months ORDER BY month_key DESC")],
                            "user": safe_user(user),
                        },
                    )
                return
            super().do_GET()
        except Exception as error:
            print(f"GET {path} failed: {error}", file=sys.stderr)
            write_json(self, 500, {"error": public_error(error)})

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            if path == "/api/auth/login":
                handle_login(self)
                return
            if path == "/api/auth/logout":
                handle_logout(self)
                return
            if path == "/api/users":
                handle_users(self)
                return

            permission = post_permission(path)
            with db() as connection:
                user = require_user(self, connection, permission)
                if not user:
                    return
                payload = read_json(self)

                if path == "/api/bootstrap":
                    if users_count(connection) == 0:
                        write_json(self, 403, {"error": "Crie o administrador inicial antes de importar dados."})
                        return
                    bootstrap_data(connection, user, payload)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/products":
                    old_data = get_json_by_id(connection, "products", payload["id"])
                    save_product(connection, payload)
                    audit(connection, user, "upsert", "products", payload["id"], old_data, payload)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/product-movement":
                    product = payload["product"]
                    movement = payload["movement"]
                    old_data = get_json_by_id(connection, "products", product["id"])
                    lock_product(connection, product["id"])
                    save_product(connection, product)
                    save_movement(connection, movement)
                    audit(connection, user, "movement", "products", product["id"], old_data, product, movement.get("quantity"), movement.get("note", ""))
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/purchase-receive":
                    purchase = payload["purchase"]
                    old_purchase = get_json_by_id(connection, "purchases", purchase["id"])
                    save_purchase(connection, purchase)
                    for product in payload.get("products", []):
                        old_product = get_json_by_id(connection, "products", product["id"])
                        lock_product(connection, product["id"])
                        save_product(connection, product)
                        audit(connection, user, "receive_purchase", "products", product["id"], old_product, product, note=purchase.get("orderNumber", ""))
                    for movement in payload.get("movements", []):
                        save_movement(connection, movement)
                    audit(connection, user, "receive_purchase", "purchases", purchase["id"], old_purchase, purchase)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/bulk":
                    for product in payload.get("products", []):
                        old_product = get_json_by_id(connection, "products", product["id"])
                        lock_product(connection, product["id"])
                        save_product(connection, product)
                        audit(connection, user, "bulk_update", "products", product["id"], old_product, product)
                    for movement in payload.get("movements", []):
                        save_movement(connection, movement)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/shipments":
                    old_data = get_json_by_id(connection, "shipments", payload["id"])
                    save_shipment(connection, payload)
                    audit(connection, user, "upsert", "shipments", payload["id"], old_data, payload)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/purchases":
                    old_data = get_json_by_id(connection, "purchases", payload["id"])
                    save_purchase(connection, payload)
                    audit(connection, user, "upsert", "purchases", payload["id"], old_data, payload)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/dre":
                    old_data = get_json_by_id(connection, "dre_records", payload["id"])
                    save_dre(connection, payload)
                    audit(connection, user, "upsert", "dre_records", payload["id"], old_data, payload)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/cash":
                    payload["id"] = "main"
                    old_data = fetchone(connection, "SELECT data FROM cash_state WHERE id = 'main'")
                    upsert_row(connection, "cash_state", ["id", "data"], ("main", json_text(payload)))
                    audit(connection, user, "upsert", "cash_state", "main", load_json_row(old_data) if old_data else None, payload)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/account-entries":
                    old_data = get_json_by_id(connection, "account_entries", payload["id"])
                    save_account_entry(connection, payload)
                    audit(connection, user, "upsert", "account_entries", payload["id"], old_data, payload)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                if path == "/api/account-months":
                    old_row = fetchone(connection, "SELECT data FROM account_months WHERE month_key = ?", (payload.get("monthKey", ""),))
                    save_account_month(connection, payload)
                    audit(connection, user, "upsert", "account_months", payload.get("monthKey", ""), load_json_row(old_row) if old_row else None, payload)
                    connection.commit()
                    write_json(self, 200, {"ok": True})
                    return

                write_json(self, 404, {"error": "Endpoint nao encontrado."})
        except Exception as error:
            print(f"POST {path} failed: {error}", file=sys.stderr)
            write_json(self, 500, {"error": public_error(error)})

    def do_DELETE(self):
        path = urlparse(self.path).path
        try:
            permission, table = delete_permission(path)
            if not permission:
                write_json(self, 404, {"error": "Endpoint nao encontrado."})
                return
            record_id = unquote(path.rsplit("/", 1)[-1])
            with db() as connection:
                user = require_user(self, connection, permission)
                if not user:
                    return
                old_data = soft_delete(connection, table, record_id)
                audit(connection, user, "delete", table, record_id, old_data, None)
                connection.commit()
            write_json(self, 200, {"ok": True})
        except Exception as error:
            print(f"DELETE {path} failed: {error}", file=sys.stderr)
            write_json(self, 500, {"error": public_error(error)})


def post_permission(path):
    if path in ["/api/products"]:
        return "products:write"
    if path in ["/api/product-movement", "/api/bulk", "/api/purchase-receive"]:
        return "stock:write"
    if path == "/api/shipments":
        return "shipments:write"
    if path == "/api/purchases":
        return "purchases:write"
    if path == "/api/dre":
        return "dre:write"
    if path == "/api/cash":
        return "cash:write"
    if path in ["/api/account-entries", "/api/account-months"]:
        return "account:write"
    if path == "/api/bootstrap":
        return "admin"
    return "admin"


def delete_permission(path):
    if path.startswith("/api/products/"):
        return "products:delete", "products"
    if path.startswith("/api/shipments/"):
        return "shipments:delete", "shipments"
    if path.startswith("/api/purchases/"):
        return "purchases:delete", "purchases"
    if path.startswith("/api/dre/"):
        return "dre:delete", "dre_records"
    if path.startswith("/api/account-entries/"):
        return "account:delete", "account_entries"
    return None, None


def lock_product(connection, product_id):
    if is_postgres():
        fetchone(connection, "SELECT id FROM products WHERE id = ? FOR UPDATE", (product_id,))


def bootstrap_data(connection, user, payload):
    if fetchone(connection, "SELECT COUNT(*) AS total FROM products")["total"] == 0:
        for product in payload.get("products", []):
            save_product(connection, product)
        for movement in payload.get("movements", []):
            save_movement(connection, movement)
    if fetchone(connection, "SELECT COUNT(*) AS total FROM shipments")["total"] == 0:
        for shipment in payload.get("shipments", []):
            save_shipment(connection, shipment)
    if fetchone(connection, "SELECT COUNT(*) AS total FROM purchases")["total"] == 0:
        for purchase in payload.get("purchases", []):
            save_purchase(connection, purchase)
    if fetchone(connection, "SELECT COUNT(*) AS total FROM dre_records")["total"] == 0:
        for record in payload.get("dreRecords", []):
            save_dre(connection, record)
    if fetchone(connection, "SELECT COUNT(*) AS total FROM cash_state")["total"] == 0 and payload.get("cashState"):
        upsert_row(connection, "cash_state", ["id", "data"], ("main", json_text(payload["cashState"])))
    if fetchone(connection, "SELECT COUNT(*) AS total FROM account_entries")["total"] == 0:
        for entry in payload.get("accountEntries", []):
            save_account_entry(connection, entry)
    if fetchone(connection, "SELECT COUNT(*) AS total FROM account_months")["total"] == 0:
        for month_state in payload.get("accountMonths", []):
            save_account_month(connection, month_state)
    audit(connection, user, "bootstrap", "database", note="Importacao inicial do navegador")


def main():
    try:
        with db():
            pass
    except Exception as error:
        print(f"Aviso: nao foi possivel preparar o banco na inicializacao: {public_error(error)}", file=sys.stderr)
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", "4173"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Sistema aberto em http://{host}:{port}/index.html")
    server.serve_forever()


if __name__ == "__main__":
    main()
