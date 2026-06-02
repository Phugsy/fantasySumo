.DEFAULT_GOAL := help
PNPM ?= $(shell if command -v pnpm >/dev/null 2>&1; then command -v pnpm; elif [ -x /opt/homebrew/bin/pnpm ]; then echo /opt/homebrew/bin/pnpm; else echo pnpm; fi)
PNPM_DIR := $(if $(filter /%,$(PNPM)),$(dir $(PNPM)))
ifneq ($(PNPM_DIR),)
export PATH := $(PNPM_DIR):$(PATH)
endif

.PHONY: help install dev demo dev-client dev-server build test lint format format-check check db-migrate db-seed db-seed-demo import-banzuke import-results clean

help: ## Show available make targets.
	@awk 'BEGIN {FS = ":.*## "; printf "Fantasy Sumo development commands:\n\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies with pnpm.
	CI=true $(PNPM) install --frozen-lockfile

dev: ## Start the API and Vite web app together.
	$(PNPM) dev

demo: ## Reset demo data and start the API and Vite web app.
	$(PNPM) db:migrate
	$(PNPM) db:seed:demo
	$(PNPM) dev

dev-client: ## Start only the Vite web client.
	$(PNPM) --filter @fantasy-sumo/domain build
	$(PNPM) --filter @fantasy-sumo/web dev

dev-server: ## Start only the Fastify API server.
	$(PNPM) --filter @fantasy-sumo/domain build
	$(PNPM) --filter @fantasy-sumo/api dev

build: ## Build all workspace packages and apps.
	$(PNPM) build

test: ## Run all tests.
	$(PNPM) test

lint: ## Run ESLint.
	$(PNPM) lint

format: ## Format files with Prettier.
	$(PNPM) format

format-check: ## Check Prettier formatting.
	$(PNPM) format:check

check: ## Run the main pre-PR validation suite.
	$(PNPM) lint
	$(PNPM) format:check
	$(PNPM) test
	$(PNPM) build

db-migrate: ## Apply local database migrations.
	$(PNPM) db:migrate

db-seed: ## Seed the local database.
	$(PNPM) db:seed

db-seed-demo: ## Reset and seed the deterministic demo database.
	$(PNPM) db:seed:demo

import-banzuke: ## Import current banzuke data from source.
	$(PNPM) import:banzuke $(ARGS)

import-results: ## Import daily results from source. Pass ARGS="-- --basho 2026-05 --day 1".
	$(PNPM) import:results $(ARGS)

clean: ## Remove generated build artifacts.
	rm -rf apps/api/dist apps/web/dist packages/db/dist packages/domain/dist
