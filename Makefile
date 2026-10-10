SHELL := /bin/bash
NODE_MAJOR := $(shell node -p 'process.versions.node.split(".")[0]' 2>/dev/null)

.PHONY: setup dev check-node db-start eval test stop reset

## Install dependencies, start local Supabase, apply migrations and load the data.
setup: check-node
	npm ci
	$(MAKE) db-start
	npx supabase migration up --local
	node scripts/write-env.ts
	node --env-file=.env.local scripts/seed.ts
	@echo "✔ Setup complete. Run 'make dev' and open http://localhost:3000"

## Serve the app on http://localhost:3000.
dev: check-node
	@test -f .env.local || (echo "Run 'make setup' first." && exit 1)
	@npx supabase status >/dev/null 2>&1 || $(MAKE) db-start
	npx next dev --port 3000

db-start:
	@docker info >/dev/null 2>&1 || (echo "Docker is not running. Start Docker Desktop and retry." && exit 1)
	npx supabase start

check-node:
	@if [ "$(NODE_MAJOR)" != "24" ]; then echo "Node 24 is required (found $$(node -v 2>/dev/null || echo none)). Run 'nvm use' (see .nvmrc)."; exit 1; fi

## Check search against a queries file (default data/queries.json; make eval QUERIES=path).
## Needs the dev server and ANTHROPIC_API_KEY.
eval:
	node --env-file=.env.local scripts/eval-queries.ts $(QUERIES)

## Tenant-isolation, billing and free-plan checks against the running app.
test:
	node --env-file=.env.local scripts/test-api.ts

stop:
	npx supabase stop

## Wipe the database and load everything again.
reset:
	npx supabase db reset --local
	node --env-file=.env.local scripts/seed.ts
