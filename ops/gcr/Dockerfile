# cf. https://turbo.build/repo/docs/handbook/deploying-with-docker
FROM node:20-bookworm-slim AS node_base
WORKDIR /app

#
# base: stuff that basically never changes
#
FROM node_base as base
WORKDIR /app

# all of my favorite languages! some of the node packages call python anyway
RUN apt-get update
RUN apt-get install -y build-essential curl git libudev-dev nodejs pkg-config python3 python3-dev python3-pip

RUN npm install -g node-gyp

# pnpm sucks
ENV PNPM_HOME="/usr/local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN curl -fsSL https://get.pnpm.io/install.sh | bash -
# https://nextjs.org/docs/messages/sharp-missing-in-production
RUN pnpm add -g copyfiles prisma sharp next typescript @types/react @types/node

# all bc we need gsutil cp at the end
RUN curl -o ./install_google_cloud_sdk.bash https://sdk.cloud.google.com
RUN bash ./install_google_cloud_sdk.bash --disable-prompts --install-dir=/usr/local

RUN pip install --upgrade --break-system-packages google-cloud-storage google-cloud-bigquery google-cloud-pubsub google-cloud-secret-manager

# Don't run production as root
RUN addgroup --system --gid 500 nodejs
RUN adduser --system --uid 500 nextjs
