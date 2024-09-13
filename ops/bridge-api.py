#!/usr/bin/env python3
import argparse
import getpass
import json
import os
import requests
import logging
import uuid

import psycopg2
from psycopg2.extras import DictCursor
from psycopg2.extensions import AsIs
from psycopg2.errors import ForeignKeyViolation, UniqueViolation
from urllib.parse import urlparse

# Initialize logging
logging.basicConfig()
logging.getLogger().setLevel(logging.DEBUG)
requests_log = logging.getLogger("urllib3")
requests_log.setLevel(logging.DEBUG)
requests_log.propagate = True

"""
dave@panigale ~/s/juniper (main)> ./ops/bridge-api.py --live --api_key sk-live-xxxx  --insert UserBridge --postgres_dsn postgres://postgres@localhost/juniper kyc_links
"""


def main():
    parser = argparse.ArgumentParser(description="Bridge.xyz API tool")
    #
    parser.add_argument(
        "--api_key", required=True, help="The API key to include in the request headers"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        default=False,
        help="Boolean argument indicating if the request should be sent in live mode",
    )
    #
    parser.add_argument(
        "--delete", action="store_true", help="The customer ID to delete"
    )
    parser.add_argument(
        "--post", type=str, help="JSON to post to the API (use - for an input())"
    )
    parser.add_argument(
        "--limit", type=int, default=100, help="The limit for the request"
    )
    #
    parser.add_argument("--insert", type=str, help="The table name to insert")
    parser.add_argument(
        "--postgres_dsn",
        type=str,
        help="DSN of the db to connect to. If you are using cloud-sql-proxy this is just postgres://postgres@localhost/<dbname>",
        default="postgres://postgres@localhost/juniper",
    )

    parser.add_argument("command", help="The command to execute")

    args = parser.parse_args()
    url_prefix = (
        "https://api.bridge.xyz" if args.live else "https://api.sandbox.bridge.xyz"
    )
    url = "%s/v0/%s" % (url_prefix, args.command)
    headers = {"accept": "application/json", "api-key": args.api_key}

    params = {"limit": args.limit}

    response = None
    if args.post:
        data = None
        if args.post == "-":
            data = json.loads(input("Paste JSON and hit Enter:\n"))
        else:
            data = json.load(open(args.post))
        headers["idempotency-key"] = uuid.uuid4().hex
        headers["content-type"] = "application/json"
        print("Sending request to %s headers: %s data: %s" % (url, headers, data))
        response = requests.post(url, headers=headers, json=data)
    elif args.delete:
        response = requests.delete(url, headers=headers)
    else:
        response = requests.get(url, headers=headers, params=params)

    data = response.json()
    if args.insert:
        assert args.postgres_dsn
        print("Connecting %s" % args.postgres_dsn)
        parsed_url = urlparse(args.postgres_dsn)
        password = parsed_url.password
        if not password:
            password = os.getenv("POSTGRES_PASSWORD")
            if not password:
                password = getpass.getpass(f"Password for {args.postgres_dsn}: ")

        conn = psycopg2.connect(dsn=args.postgres_dsn, password=password)
        cursor = conn.cursor(cursor_factory=DictCursor)

        # override mappings. when you have users active in both staging and prod, you need to fixup our data in UserBridge such that the bridge customer ID and kyc links map somewhere
        cursor.execute('SELECT email, id FROM "JuniperUser"')
        overrides = dict(cursor.fetchall())
        overrides = {k: {"full_name": v} for k, v in overrides.items()}

        # shoulda just built on live to begin with
        if "dave@tungstenfi.com" in overrides:
            overrides["dave+collision@tungstenfi.com"] = overrides[
                "dave@tungstenfi.com"
            ]

        # ...
        for row in data["data"]:
            if row["email"] in overrides:
                row.update(overrides[row["email"]])

            # we can actually use their record of the "full name" as an ownerId link, at least for this import/fixup script
            if "-" not in row["full_name"]:
                print(
                    f'{row["email"]} Skipping cannot resolve owner {row["full_name"]}'
                )
                continue

            if "+test" in row["email"]:
                print(f'{row["email"]} Skipping test email')
                continue

            if row["customer_id"]:
                valid_url = "%s/v0/customers/%s" % (url_prefix, row["customer_id"])
                print(f'{row["email"]} validating {valid_url}')
                valid = requests.get(valid_url, headers=headers)
                if valid.status_code != 200:
                    print(
                        f'{row["email"]} Skipping bridge error {row["full_name"]}, {valid}'
                    )
                    continue

            print(f'{row["email"]} Inserting {row["id"]}')
            try:
                cursor.execute(
                    """
					INSERT INTO "%s" (id, email, type, "kycLink", "tosLink", "kycStatus", "tosStatus", "createdAt", "customerId", "ownerId")
					VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        AsIs(args.insert),
                        row["id"],
                        row["email"],
                        row["type"],
                        row["kyc_link"],
                        row["tos_link"],
                        row["kyc_status"],
                        row["tos_status"],
                        row["created_at"],
                        row["customer_id"],
                        row["full_name"],
                    ),
                )
                conn.commit()
            except ForeignKeyViolation as e:
                print(
                    f'{row["email"]} Skipping cannot resolve customer {row["full_name"]}: {e}'
                )
                conn.rollback()
            except UniqueViolation as e:
                print(f'{row["email"]} Duplicate key {row["full_name"]}: {e}')
                conn.rollback()
    else:
        print(json.dumps(data, indent=4))


if __name__ == "__main__":
    main()
