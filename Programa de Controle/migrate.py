from server import db, is_postgres


def main():
    with db():
        pass
    target = "PostgreSQL" if is_postgres() else "SQLite local"
    print(f"Migrations aplicadas em {target}.")


if __name__ == "__main__":
    main()
