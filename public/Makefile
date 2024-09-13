SHORT_SHA := $(shell git rev-parse --short HEAD)
BRANCH_NAME := $(shell git rev-parse --abbrev-ref HEAD)
BUCKET := $(shell git rev-parse --abbrev-ref HEAD | cut -d/ -f1)

all:
	gsutil -q -m rsync -r ./ "gs://juniper-${BUCKET}/${SHORT_SHA}/public"
	gsutil rm -f "gs://juniper-${BUCKET}/${SHORT_SHA}/public/Makefile"
