#!/usr/bin/env python3
import os, requests, json, base64
from google.cloud import bigquery, secretmanager
import google.api_core.exceptions

from config import PROJECT_ID, SECRET_VERSION, PROD_SECRET_NAME, get_secret_json

# Privy users API
PRIVY_API_URL = "https://auth.privy.io/api/v1/users"
SECRET_NAME = "juniper-main"

# Initialize BigQuery client
client = bigquery.Client()


def main(request):
    secret_json = get_secret_json(PROD_SECRET_NAME)

    PRIVY_APP_ID = secret_json["NEXT_PUBLIC_PRIVY_APP_ID"]
    PRIVY_APP_SECRET = secret_json["PRIVY_SECRET_KEY"]

    # Constructing Basic Auth header from app ID and secret
    basicAuthHeader = base64.b64encode(
        f"{PRIVY_APP_ID}:{PRIVY_APP_SECRET}".encode()
    ).decode()
    headers = {
        "Authorization": f"Basic {basicAuthHeader}",
        "privy-app-id": PRIVY_APP_ID,
    }

    # Define BigQuery dataset and table
    dataset_id = "etl"
    table_id = "privy_user"
    table_ref = client.dataset(dataset_id).table(table_id)

    # Define the schema of the BigQuery table
    job_config = bigquery.LoadJobConfig(
        schema=[
            bigquery.SchemaField("id", "STRING"),
            bigquery.SchemaField("created_at", "TIMESTAMP"),
            bigquery.SchemaField("wallet", "JSON"),
            bigquery.SchemaField("email", "JSON"),
            bigquery.SchemaField("phone", "STRING"),
            bigquery.SchemaField("google_oauth", "JSON"),
            bigquery.SchemaField("twitter_oauth", "JSON"),
            bigquery.SchemaField("discord_oauth", "JSON"),
            bigquery.SchemaField("github_oauth", "JSON"),
            bigquery.SchemaField("apple_oauth", "JSON"),
            bigquery.SchemaField("linkedin_oauth", "JSON"),
            bigquery.SchemaField("tiktok_oauth", "JSON"),
            bigquery.SchemaField("custom", "JSON"),
            bigquery.SchemaField("mfa_methods", "STRING", mode="REPEATED"),
            bigquery.SchemaField("has_accepted_terms", "BOOLEAN"),
        ],
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )

    # Fetch first page of users
    response = requests.get(PRIVY_API_URL, headers=headers)
    content = json.loads(response.content)
    data = content["data"]
    next_cursor = content["next_cursor"]

    # Fetch remaining pages of data
    while next_cursor:
        response = requests.get(
            f"{PRIVY_API_URL}?cursor={next_cursor}", headers=headers
        )
        content = json.loads(response.content)
        append_data = content["data"]
        data.extend(append_data)
        next_cursor = content["next_cursor"]

    # Prepare the data for BigQuery
    for user in data:
        for account in user.get("linked_accounts", []):
            user[account["type"]] = account
        user.pop("linked_accounts", None)
        user.pop("is_guest", None)

    # Load data into BigQuery
    job = client.load_table_from_json(data, table_ref, job_config=job_config)
    job.result()  # Wait for the job to complete

    return "Data load completed", 200


if __name__ == "__main__":
    main("")
