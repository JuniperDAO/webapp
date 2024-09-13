#!/usr/bin/env python3

import argparse
import datetime
import getpass
import glob
import hashlib
import os
import os.path
from collections import OrderedDict
from urllib.parse import urlparse

import psycopg2
from psycopg2.extras import DictCursor


SCHEMA = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created TIMESTAMP DEFAULT NOW(),
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    ctime TIMESTAMP NOT NULL,
    mtime TIMESTAMP NOT NULL,
    sha256 TEXT NOT NULL
);
"""


def get_app_user_postamble(user="nodejs"):
    return f"""
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {user};
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO {user};
    """


def get_file_migrations(migrations_dir):
    dirs = glob.glob(os.path.join(migrations_dir, "*"))
    migrations = OrderedDict()
    for path in sorted(dirs):
        name = os.path.split(path)[1]
        if name == "migration_lock.toml":
            continue

        order = name.split("_")
        assert order[0].isdigit()

        sql_file = os.path.join(path, "migration.sql")
        st = os.stat(sql_file)
        migrations[name] = {
            "name": name,
            "path": sql_file,
            "size": st.st_size,
            "ctime": datetime.datetime.utcfromtimestamp(st.st_ctime),
            "mtime": datetime.datetime.utcfromtimestamp(st.st_mtime),
            "sha256": hashlib.sha256(
                open(sql_file, encoding="utf8").read().encode("utf8")
            ).hexdigest(),
        }
    return migrations


def get_db_migrations(conn):
    cursor = conn.cursor(cursor_factory=DictCursor)
    rows = []
    try:
        cursor.execute("select * from migrations")
        rows = cursor.fetchall()
    except psycopg2.errors.UndefinedTable:
        conn.rollback()
        rc = cursor.execute(SCHEMA)
        conn.commit()
        print(f"Created migration table: {rc}")
    assert rows is not None
    return rows


def main():
    parser = argparse.ArgumentParser(description="Run SQL migrations")
    parser.add_argument(
        "postgres_dsn",
        type=str,
        help="DSN of the db to connect to. If you are using cloud-sql-proxy this is just postgres://postgres@localhost/<dbname>",
    )
    parser.add_argument(
        "-m",
        "--migrations_dir",
        type=str,
        default="./prisma/migrations",
        help="where to look for migrations",
    )
    parser.add_argument(
        "--app_user",
        type=str,
        default="nodejs",
        help="update grants after the migration for this user",
    )
    parser.add_argument(
        "-c", "--commit", action="store_true", help="Just print the SQL statements"
    )
    args = parser.parse_args()

    parsed_url = urlparse(args.postgres_dsn)
    password = parsed_url.password
    if not password:
        password = os.getenv("POSTGRES_PASSWORD")
        if not password:
            password = getpass.getpass(f"Password for {args.postgres_dsn}: ")

    conn = psycopg2.connect(dsn=args.postgres_dsn, password=password)
    applied = get_db_migrations(conn)

    migrations = get_file_migrations(args.migrations_dir)
    assert len(migrations) > 0, f"No migrations found in {args.migrations_dir}"
    print(
        f'Found {len(migrations)} migrations in {args.migrations_dir}: {", ".join(x for x in migrations)}'
    )

    # check and remove any already applied migrations
    for migration in applied:
        found = migrations.pop(migration["name"], None)
        assert found, ("Deleted migration?", migration)
        # assert migration['sha256'] == found['sha256'], ('Checksum mismatch', migration, found)

    if not migrations:
        print(f"{args.postgres_dsn} is up to date with {args.migrations_dir}, exiting")
        return

    if not args.commit:
        print("No -c/--commit flag given, just printing to stdout")

    # apply any leftover migrations
    for migration in migrations.values():
        print(f'Applying {migration["name"]}')
        migration_sql = open(migration["path"], encoding="utf8").read()
        recordkeeping_sql = "insert into migrations (name, size, ctime, mtime, sha256) values (%s, %s, %s, %s, %s)"
        values = tuple(
            migration[k] for k in ("name", "size", "ctime", "mtime", "sha256")
        )

        if args.commit:
            cursor = conn.cursor(cursor_factory=DictCursor)
            cursor.execute(migration_sql)
            print(f'Executing SQL in {migration["path"]}')

            # because we run the app server as a depermissioned user, it needs to have its grants updated if there are create table statements in the migration
            cursor.execute(get_app_user_postamble(user=args.app_user))
            print(f"Updating grants for {args.app_user}")

            cursor.execute(recordkeeping_sql, values)
            conn.commit()
            print(f'Committed {migration["name"]}')
        else:
            print(f'(not) Executing SQL in {migration["path"]}')
            print(
                f"(not) Executing grant update as {get_app_user_postamble(user=args.app_user)}"
            )
            print(f"(not) Executing {recordkeeping_sql % values}")


if __name__ == "__main__":
    main()
