#!/usr/bin/env python3
import os
import sys
import subprocess
from datetime import datetime


def usage():
    print("Usage: {} migration_name".format(sys.argv[0]))
    sys.exit(1)


if len(sys.argv) != 2:
    usage()

migration_name = sys.argv[1]

if not migration_name:
    print("Error: No migration name provided.")
    usage()

# Load environment variables from .env.local file
from dotenv import load_dotenv

load_dotenv(".env.local")

postgres_prisma_url = os.getenv("POSTGRES_PRISMA_URL")

if not postgres_prisma_url:
    print(
        "Error: Failed to retrieve the POSTGRES_PRISMA_URL variable from the .env.local file."
    )
    sys.exit(1)

timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
dir_name = "{}_{}".format(timestamp, migration_name)

migration_dir = os.path.join("prisma", "migrations", dir_name)
os.makedirs(migration_dir, exist_ok=True)

migration_file_path = os.path.join(migration_dir, "migration.sql")

try:
    with open(migration_file_path, "w") as migration_file:
        subprocess.run(
            [
                "prisma",
                "migrate",
                "diff",
                "--from-url",
                postgres_prisma_url,
                "--to-schema-datamodel",
                "prisma/schema.prisma",
                "--script",
            ],
            stdout=migration_file,
            check=True,
        )
    print("Directory '{}' created successfully.".format(dir_name))
except subprocess.CalledProcessError:
    print("Failed to create directory '{}'.".format(dir_name))
    sys.exit(1)
