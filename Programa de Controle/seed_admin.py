import os
import uuid

from server import active_value, db, execute, fetchone, hash_password, normalize_email, upsert_row, now_ms


def main():
    email = normalize_email(os.environ.get("ADMIN_EMAIL"))
    password = os.environ.get("ADMIN_PASSWORD", "")
    name = os.environ.get("ADMIN_NAME", "Administrador")

    if not email:
        raise SystemExit("Configure ADMIN_EMAIL antes de executar o seed.")
    if len(password) < 8:
        raise SystemExit("Configure ADMIN_PASSWORD com pelo menos 8 caracteres.")

    with db() as connection:
        existing = fetchone(connection, "SELECT id FROM users WHERE email = ?", (email,))
        if existing:
            execute(
                connection,
                """
                UPDATE users
                SET name = ?, role = ?, password_hash = ?, active = ?, updated_at = ?
                WHERE email = ?
                """,
                (name, "admin", hash_password(password), active_value(True), now_ms(), email),
            )
            connection.commit()
            print(f"Administrador atualizado: {email}")
            return

        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "role": "admin",
            "password_hash": hash_password(password),
            "active": active_value(True),
            "created_at": now_ms(),
            "updated_at": now_ms(),
        }
        upsert_row(
            connection,
            "users",
            ["id", "email", "name", "role", "password_hash", "active", "created_at", "updated_at"],
            tuple(user.values()),
        )
        connection.commit()
    print(f"Administrador criado: {email}")


if __name__ == "__main__":
    main()
