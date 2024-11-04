#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse
import json
import os
import subprocess
import shutil

# use --build to run the build process akin to the CI
parser = argparse.ArgumentParser(description="Juniper Dev Script")
parser.add_argument(
    "--build", action="store_true", help="Run the build process (not the dev server)"
)
cli = parser.parse_args()


def local(bin):
    return os.path.join("./node_modules/.bin", bin)


# Get the short SHA of the current git commit
short_sha = (
    subprocess.check_output(["git", "rev-parse", "--short", "HEAD"]).decode().strip()
)

# Get the name of the current git branch
branch_name = (
    subprocess.check_output(["git", "branch", "--show-current"]).decode().strip()
)

# Set the environment variables
env = os.environ.copy()
env.update(
    {
        "NEXT_PUBLIC_SHORT_SHA": short_sha,
        "NEXT_PUBLIC_BRANCH_NAME": branch_name,
        "BRANCH_NAME": branch_name,
    }
)

# secret_name = (
#     subprocess.check_output(["./ops/env-cloudbuild", "secret_name"], env=env)
#     .decode()
#     .strip()
# )
# this script is only for dev
secret_name = "juniper-staging"
env.update({"SECRET_NAME": secret_name})


def update_deps():
    # key package updates
    print("jnpr% updating packages")
    packages = json.loads(open("package.json").read())
    deps = set(packages["dependencies"])
    # do not update ethers, it breaks the build
    deps.remove("ethers")
    deps.remove("@zerodev/sdk")  # also breaking
    deps.remove("@alchemy/aa-core")  # also breaking
    args = [shutil.which("pnpm"), "update"]
    args.extend(sorted(deps))
    args.append("--latest")
    print(f"jnpr% updating {' '.join(sorted(deps))}")
    deps_output = subprocess.check_output(args, env=env).decode().strip()
    print(deps_output)


def cdn_sync():
    # CDN sync
    if short_sha != "main":
        print(f"jnpr% syncing to CDN hash {short_sha}")
        subprocess.run(
            [shutil.which("pnpm"), "public-cdn"], env=env, capture_output=True
        )
    else:
        print("Not running public-cdn because the branch is main")


def prisma_generate():
    # prisma schema
    print("jnpr% prisma generate")
    subprocess.run([local("prisma"), "generate"], env=env, capture_output=True)


def run_and_wait_dev_server():
    # Even though there is no longer a psql proxy running into GCP, we still need to
    # avoid running dev on main, because it will break the CDN sync
    assert branch_name != "main", "You should not run dev on main, create a branch."

    print(f"jnpr% dev {short_sha} {branch_name} {secret_name} starting")
    # postgres, in the background
    # getting started:
    # brew install postgresql
    # brew services stop postgresql # because we run it here
    # createdb -h 127.0.0.1 -U dave juniper
    # createuser -U dave --interactive nodejs
    # juniper=# GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nodejs;
    print("jnpr% starting local postgres")
    psql = subprocess.Popen(
        [shutil.which("brew"), "services", "run", "postgresql"], env=env
    )

    # redis, also in the background
    print("jnpr% starting redis")
    redis_server = subprocess.Popen([shutil.which("redis-server")], env=env)

    # ngrok, in the background -- assumes you have this configured with "ngrok config edit"
    # set console_ui: false in the config to make it not shit all over your terminal
    print("jnpr% starting ngrok")
    ngrok = subprocess.Popen([shutil.which("ngrok"), "start", "--all"], env=env)

    dev_server = None
    try:
        print(f"jnpr% next dev, with secrets from {secret_name}")
        dev_server = subprocess.Popen(
            [
                "./ops/secret-exec",
                secret_name,
                # sort of the one case, we have to override this since REDIS is on localhost
                "-e",
                "REDIS_URL=127.0.0.1",
                "--postgres-sql-proxy",
                f"{local('next')} dev",
            ],
            env=env,
        )
        dev_server.wait()
    except KeyboardInterrupt as e:
        print("jnpr% caught KeyboardInterrupt")

    print("jnpr% stopping ngrok postgres redis-server etc")
    ngrok.kill()
    psql.kill()
    redis_server.kill()
    if dev_server:
        dev_server.kill()


if cli.build:
    print(f"jnpr% next build, with secrets from {secret_name}")
    prisma_generate()
    builder = subprocess.Popen(
        [
            "./ops/secret-exec",
            secret_name,
            f"{local('next')} build",
        ],
        env=env,
    )
    builder.wait()
else:
    # update_deps()
    cdn_sync()
    prisma_generate()
    run_and_wait_dev_server()
