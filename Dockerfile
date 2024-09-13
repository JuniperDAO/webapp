# cf. https://turbo.build/repo/docs/handbook/deploying-with-docker
FROM gcr.io/tungstenfi/juniper-base:latest AS base
WORKDIR /app

# hardcoded
ENV LOAD_BALANCER=custom-domains-49a4

# passed in from cloudbuild.yaml, main = production, staging = staging
ARG BRANCH_NAME
ENV BRANCH_NAME=$BRANCH_NAME
# additional parameters from cloudbuild.yaml
ARG BUCKET_NAME
ENV BUCKET_NAME=$BUCKET_NAME
ARG SECRET_NAME
ENV SECRET_NAME=$SECRET_NAME
# only used internally here
ARG CACHE_BUCKET_NAME
ENV CACHE_BUCKET_NAME=$CACHE_BUCKET_NAME

# used for gsutil/CDN cache versioning
ARG SHORT_SHA
ENV SHORT_SHA=$SHORT_SHA
ENV NEXT_PUBLIC_SHORT_SHA=$SHORT_SHA

# ...
ENV PATH=/app/node_modules/.bin:/usr/local/google-cloud-sdk/bin:/app/node_modules/.bin:$PATH

# turn off nextjs builtin stuff
ENV NEXT_TELEMETRY_DISABLED=1
ENV NO_UPDATE_NOTIFIER=true

# for pnpm
ENV CI=1

COPY package.json .
COPY pnpm-lock.yaml .
COPY prisma .

# Ghetto Next.js cache read
RUN gsutil mb "gs://${CACHE_BUCKET_NAME}" || true
RUN gsutil cp "gs://$CACHE_BUCKET_NAME/nextjs-cache.tar.gz" /tmp/nextjs-cache.tar.gz || true
RUN (cd / && tar zxf /tmp/nextjs-cache.tar.gz || true)
RUN du -csh /app/.next/cache /app/node_modules

# Install pass 1
RUN pnpm install --no-optional --no-frozen-lockfile

# ... pruned app builder
FROM base AS builder
WORKDIR /app

ENV NEXT_PUBLIC_BRANCH_NAME=$BRANCH_NAME

COPY . .
RUN ./ops/ofac-update.py -p libs/ofac.json

# explicitly prisma generate?
RUN prisma generate

# Build the application
RUN ./ops/secret-exec --next-public-only $SECRET_NAME "pnpm build"

# reinstall, only production deps
RUN pnpm install --no-optional --production --no-frozen-lockfile

# Ghetto Next.js cache write
RUN tar zcf /tmp/nextjs-cache.tar.gz /app/.next/cache /app/node_modules
RUN gsutil cp /tmp/nextjs-cache.tar.gz "gs://$CACHE_BUCKET_NAME/nextjs-cache.tar.gz"
RUN rm -f /tmp/nextjs-cache.tar.gz

# ... subsequent steps ...
# CDN deploy. Can this then be out of sync with the app server though?
RUN gsutil mb "gs://$BUCKET_NAME" || true
RUN echo CDN directory is "gs://$BUCKET_NAME/$SHORT_SHA/_next/static"
RUN gsutil -q -m rsync -r /app/.next/static "gs://$BUCKET_NAME/$SHORT_SHA/_next/static"

# also do /public for images & whatnot. locally, you can do this with (cd public && make)
RUN gsutil -q -m rsync -r /app/public "gs://$BUCKET_NAME/$SHORT_SHA/public"

RUN mkdir -p /app/.next/cache
RUN chown nextjs /app/.next/cache

# Don't run production as root
USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ./ops/secret-exec $SECRET_NAME "pnpm start"
