.PHONY: build help

help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: package.json ## install dependencies
	npm install;

start-supabase: ## start supabase locally
	@bash -c 'if [ -f supabase/.env ]; then \
		echo "Loading environment variables from supabase/.env..."; \
		set -a; \
		source supabase/.env; \
		set +a; \
		npx supabase start; \
	else \
		echo "Warning: supabase/.env not found. Starting Supabase without SMTP configuration."; \
		npx supabase start; \
	fi'

start-supabase-functions: ## start the supabase Functions watcher
	npx supabase functions serve --env-file supabase/functions/.env.development

supabase-migrate-database: ## apply the migrations to the database
	npx supabase migration up

supabase-reset-database: ## reset (and clear!) the database
	npx supabase db reset

backup-database: ## create a database backup (requires BACKUP_DIR env var, set inline)
	node scripts/backup-database.mjs

restore-database: ## restore database from backup (usage: make restore-database BACKUP_PREFIX=backup-2024-01-15-120000 [REWRITE_URLS=1] [REWRITE_FROM=http://127.0.0.1:54321] [REWRITE_TO=http://100.110.86.5:54321])
	@if [ -z "$$BACKUP_PREFIX" ]; then \
		echo "Error: BACKUP_PREFIX environment variable is not set."; \
		echo "Usage: make restore-database BACKUP_PREFIX=backup-2024-01-15-120000"; \
		echo "Or provide full path: make restore-database BACKUP_PREFIX=/path/to/backups/backup-2024-01-15-120000"; \
		echo "Optional URL rewrite: REWRITE_URLS=1 REWRITE_FROM=http://127.0.0.1:54321 REWRITE_TO=http://100.110.86.5:54321"; \
		echo "Note: BACKUP_DIR must be set if using just the prefix."; \
		exit 1; \
	fi
	@if [ -n "$$REWRITE_URLS" ]; then \
		if [ -z "$$REWRITE_FROM" ] || [ -z "$$REWRITE_TO" ]; then \
			echo "Error: REWRITE_URLS requires both REWRITE_FROM and REWRITE_TO."; \
			echo "Example: REWRITE_URLS=1 REWRITE_FROM=http://127.0.0.1:54321 REWRITE_TO=http://100.110.86.5:54321"; \
			exit 1; \
		fi; \
		node scripts/restore-database.mjs $$BACKUP_PREFIX --rewrite-urls --rewrite-from=$$REWRITE_FROM --rewrite-to=$$REWRITE_TO; \
	else \
		node scripts/restore-database.mjs $$BACKUP_PREFIX; \
	fi

list-backups: ## list available backups (requires BACKUP_DIR env var, set inline)
	node scripts/list-backups.mjs

start-app: ## start the app locally
	npm run dev

start: start-supabase start-app ## start the stack locally

start-demo: ## start the app locally in demo mode
	npm run dev:demo

stop-supabase: ## stop local supabase
	npx supabase stop

stop: stop-supabase ## stop the stack locally

build: ## build the app
	npm run build

build-demo: ## build the app in demo mode
	npm run build:demo

build-lib: ## build the library
	npm run build-lib

prod-start: build supabase-deploy
	open http://127.0.0.1:3000 && npx serve -l tcp://127.0.0.1:3000 dist

prod-deploy: build supabase-deploy
	npm run ghpages:deploy

supabase-remote-init:
	npm run supabase:remote:init
	$(MAKE) supabase-deploy

supabase-deploy:
	npx supabase db push
	npx supabase functions deploy

test:
	npm test

test-ci:
	CI=1 npm test

lint:
	npm run lint:check
	npm run prettier:check

publish:
	npm run build-lib
	npm publish

typecheck:
	npm run typecheck
