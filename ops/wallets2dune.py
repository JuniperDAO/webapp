#!/usr/bin/env python3
import os, requests, json, base64
from google.cloud import bigquery
from dune_client.client import DuneClient

from config import PROJECT_ID, SECRET_VERSION, PROD_SECRET_NAME, get_secret_json
import csv
import tempfile
import datetime

# Initialize BigQuery client
bigquery_client = bigquery.Client()

QUERY = """
select smartContractWalletAddress, 'optimism' from `public.UserSmartWallet` order by 1 asc
"""


# Function to query BigQuery table
def query_bigquery(sql_query):
    query_job = bigquery_client.query(sql_query)
    results = query_job.result()  # Wait for the job to complete.
    # Save results to a local CSV file
    with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
        writer = csv.writer(f)
        # Write column names
        writer.writerow([field.name for field in results.schema])
        for row in results:
            # Write row values
            writer.writerow([getattr(row, field.name) for field in results.schema])
        temp_file_path = f.name

    return temp_file_path


def main(request):
    # Query BigQuery
    path = query_bigquery(QUERY)
    print("Query saved to %s" % path)

    # Initialize Dune client
    dune_client = DuneClient("3iSCkaCgUYWHjvfYhndPgExwtOaZfjf7")

    # Define the table name
    table_name = "juniper_smart_wallets"

    # Upload the CSV file to Dune
    current_datetime = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    data = open(path, "rb").read().decode()
    print("Uploading CSV file to Dune table: %s (%d bytes)" % (table_name, len(data)))
    dune_client.upload_csv(table_name, data, f"wallets {current_datetime}")

    # Print success message
    print("CSV file uploaded to Dune table: %s" % table_name)

    return "Data load completed", 200


if __name__ == "__main__":
    main("")
