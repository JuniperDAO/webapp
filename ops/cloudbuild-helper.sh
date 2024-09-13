#!/bin/bash
set -x

if [ "${BRANCH_NAME}" = "" ]; then
    echo "BRANCH_NAME not set, exiting"
    exit -1
fi

LOAD_BALANCER=custom-domains-49a4
PROJECT_ID=tungstenfi
REGION=us-central1
SUBDOMAIN=$(ops/env-cloudbuild subdomain)
PATH_MATCHER=$(ops/env-cloudbuild path_matcher)

BACKEND_SERVICE=$(ops/env-cloudbuild service_name)
BASE_URI=$(ops/env-cloudbuild base_uri)
BUCKET_NAME=$(ops/env-cloudbuild bucket_name)
HOSTNAME=$(ops/env-cloudbuild hostname)

SERVICE_ACCOUNT_EMAIL=tungstenfi@appspot.gserviceaccount.com
JOB_TIMEOUT=540s

# vs --region everywhere unpredictably
gcloud config set functions/region ${REGION}
gcloud config set run/region ${REGION}

# static file setup
# static file/CDN buckets setup
gsutil mb gs://${BUCKET_NAME} || true
gsutil defacl set public-read gs://${BUCKET_NAME} || true
gsutil cors set ops/gsutil-cdn-bucket-cors.json gs://${BUCKET_NAME} || true
gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} \
  --member=allUsers \
  --role=roles/storage.objectViewer || true

# Create the network endpoint group for the cloud run service
gcloud compute network-endpoint-groups create ${BACKEND_SERVICE} \
    --network-endpoint-type=SERVERLESS \
    --cloud-run-service=${BACKEND_SERVICE} \
    --region=${REGION} \
    || true

# Attempt to create the backend service
if ! gcloud compute backend-services create ${BACKEND_SERVICE} \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --protocol=HTTP \
    --global; then
  # If creation fails, it's likely that the service already exists, so we update it
  echo "Backend Service likely exists, updating..."
fi

# Update the backend service for CDN parameters
# n.b., this is disabled for now on the nextjs app - assetPrefix: should do the hard work
gcloud beta compute backend-services update \
    ${BACKEND_SERVICE} \
    --global \
    --no-enable-cdn \
    --enable-logging
    # --enable-cdn \
    # --max-ttl=31536000 \
    # --default-ttl=31536000 \
    # --custom-response-header='Cache-Status: {cdn_cache_status}' \
    # --custom-response-header='Cache-ID: {cdn_cache_id}'

# Add the NEG to the backend service
gcloud compute backend-services add-backend ${BACKEND_SERVICE} \
    --global \
    --network-endpoint-group=${BACKEND_SERVICE} \
    --network-endpoint-group-region=${REGION} \
    || true

# allow public internet traffic on main service
gcloud run services add-iam-policy-binding \
    ${BACKEND_SERVICE} \
    --member="allUsers" \
    --role="roles/run.invoker" \
    || true

# generic http retry workflow
# referral program was iterateReferrals
for workflow in httpPostRetry ; do
    gcloud workflows deploy ${workflow}-${BRANCH_NAME} \
        --source ops/workflows/${workflow}.yaml \
        --location ${REGION} &
done
wait

# register the backend service with the load balancer
# gcloud compute url-maps export custom-domains-49a4 to debug
# DY 2023-12-14: remove the automatic adding of services to the ALB. seeing behavior in which this causes a pretty disruptive reset of all the names terminated on the LB, so we want to run this command sparingly
#
# gcloud compute url-maps remove-path-matcher \
#     ${LOAD_BALANCER} \
#     --path-matcher-name=${PATH_MATCHER} \
#     || true
#
# for i in {1..5}; do
#     if gcloud compute url-maps add-path-matcher \
#         ${LOAD_BALANCER} \
#         --default-service=${BACKEND_SERVICE} \
#         --path-rules="/*=${BACKEND_SERVICE}" \
#         --new-hosts="${HOSTNAME}" \
#         --path-matcher-name=${PATH_MATCHER}; then
#             break  # Command succeeded, break out of the loop
#     elif [ "$i" -lt 5 ]; then
#         sleep 15  # Command failed, sleep for 15 seconds before retrying
#     else
#         exit 1  # Command failed after 5 attempts, exit the script
#     fi
# done

# allow service account to read the secrets
gcloud secrets add-iam-policy-binding juniper-main \
    --member=serviceAccount:${SERVICE_ACCOUNT_EMAIL} \
    --role=roles/secretmanager.secretAccessor

# and query the big
# and execute workflows
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member=serviceAccount:${SERVICE_ACCOUNT_EMAIL} \
    --role=roles/bigquery.jobUser \
    --role=roles/bigquery.dataEditor \
    --role=roles/workflows.invoker \
    --condition=None

# mailchimp was the export function
FUNCTIONS="privy2bq wallets2dune"

# import privy's user table to bigquery job
for fn in ${FUNCTIONS}; do
    gcloud functions deploy ${fn}-${BRANCH_NAME} \
        --region ${REGION} \
        --runtime python39 \
        --trigger-http \
        --entry-point main \
        --source ops \
        --set-build-env-vars=GOOGLE_FUNCTION_SOURCE=${fn}.py \
        --no-allow-unauthenticated \
        --timeout=${JOB_TIMEOUT} &

    # allow the service account to invoke the function
    # gcloud functions add-iam-policy-binding ${fn}-${BRANCH_NAME} \
    #     --member=serviceAccount:${SERVICE_ACCOUNT_EMAIL} \
    #     --role=roles/cloudfunctions.invoker \
    #     --region=${REGION}
    # # the build script never has permissions to change IAM, so we do it manually
done
wait

# set up cron job, but only for prod
COMMON_SCHEDULER_ARGS="--time-zone=America/New_York --headers=Content-Type=application/json --message-body={} --location ${REGION} --attempt-deadline=${JOB_TIMEOUT}  --oidc-service-account-email=${SERVICE_ACCOUNT_EMAIL}"

if [ "${BASE_URI}" != "" ]; then
    echo "Updating cron jobs at ${BASE_URI}..."
    gcloud scheduler jobs delete top-up-job-${BRANCH_NAME} --location ${REGION} --quiet || true

    for fn in ${FUNCTIONS}; do
        (gcloud scheduler jobs delete ${fn}-${BRANCH_NAME} --location ${REGION} --quiet || true) &
    done
    wait

    if [ "${BRANCH_NAME}" == "main" ]; then
        for fn in ${FUNCTIONS}; do
            gcloud scheduler jobs create http ${fn}-${BRANCH_NAME} ${COMMON_SCHEDULER_ARGS} \
                --schedule='0 1 * * *' \
                --uri="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${fn}-main" \
                --oidc-token-audience="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${fn}-main" &
        done
        wait

        # this encoding is impossible - created this by web console
        # gcloud scheduler jobs delete iterateReferrals-${BRANCH_NAME} --location ${REGION} --quiet || true
        # gcloud scheduler jobs create http iterateReferrals-${BRANCH_NAME} \
        #     --location=${REGION} \
        #     --schedule='0 * * * *' \
        #     --uri="https://workflowexecutions.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/workflows/iterateReferrals-${BRANCH_NAME}/executions" \
        #     --message-body='{"argument": "{\\"base_uri\\": \\"https://app.juniperfi.com/\\"}"}' \
        #     --time-zone="America/New_York" \
        #     --oauth-service-account-email=${SERVICE_ACCOUNT_EMAIL}
    else
        echo "No cron on dev servers, hit your URLs manually."
    fi
else
    echo "No cron base URI for this branch, skipping"
fi


# XXX: consider CDN flushing rules and timing
# gcloud compute url-maps invalidate-cdn-cache $LOAD_BALANCER --path '/*'
