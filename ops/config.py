import json

try:
    from google.cloud import secretmanager
except ImportError as e:
    secretmanager = None

PROJECT_ID = "tungstenfi"
SECRET_VERSION = "latest"

PROD_SECRET_NAME = "juniper-main"


def get_secret_json(secret_name):
    if not secretmanager:
        raise ImportError("google-cloud-secretmanager is not installed")
    client = secretmanager.SecretManagerServiceClient()

    # Access the secret version
    secret_path = client.secret_version_path(PROJECT_ID, secret_name, SECRET_VERSION)
    response = client.access_secret_version(request={"name": secret_path})

    # Decode the secret value
    secret_value = response.payload.data.decode("UTF-8")

    # Parse the secret value as JSON
    return json.loads(secret_value)
