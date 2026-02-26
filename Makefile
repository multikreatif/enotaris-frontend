# eNotaris Frontend (Next.js)
# Docker: override untuk push ke registry (contoh: ghcr.io/org/enotaris-frontend)

DOCKER_IMAGE ?= dedinirtadinata/enotaris-frontend
DOCKER_TAG   ?= latest

.PHONY: help dev build lint format docker-build docker-push push

help:
	@echo "  make dev          - run dev server (next dev)"
	@echo "  make build        - next build"
	@echo "  make lint         - eslint"
	@echo "  make format       - prettier write"
	@echo "  make docker-build - build Docker image $(DOCKER_IMAGE):$(DOCKER_TAG)"
	@echo "  make docker-push  - build lalu push image"
	@echo "  make push         - sama dengan docker-push"

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

format:
	npm run format

# --- Docker ---
docker-build:
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

docker-push: docker-build
	docker push $(DOCKER_IMAGE):$(DOCKER_TAG)

push: docker-push
