# Entitle

A protocol-driven benefits-entitlement agent, running entirely on local inference.

Ask a question about UK welfare entitlement and get an answer grounded in official
[GOV.UK](https://www.gov.uk) guidance, with citations — or an explicit refusal and a handoff to a
human when the question falls outside what the agent is allowed to answer.

No hosted model API. Everything runs on the machine it's deployed on.

## Status

**Week 1 of 4 — in progress.** Currently a monorepo skeleton with a working API and database.

| | |
|---|---|
| ✅ | Local inference verified — Gemma 4 26B-A4B via llama.cpp, with function calling end to end |
| ✅ | Monorepo, NestJS API, Postgres 17 + pgvector, health check |
| 🔨 | Tool-calling agent loop |
| ⬜ | Document ingestion and retrieval |
| ⬜ | Guardrails, human handoff, evaluation harness |
| ⬜ | MCP server and web UI |

## Why this exists

Preparation for an internship with [Bayes Impact](https://github.com/bayesimpact), a nonprofit
building open-source AI agents for public services.

Most self-directed RAG projects build a chatbot over some documents and stop. The parts that
actually matter for public-service AI are the unglamorous ones — keeping an agent inside a defined
scope, escalating to a human when it can't help, and being able to *measure* whether its answers
are grounded. This project builds those too.

The stack deliberately mirrors [`bayes-platform`](https://github.com/bayesimpact/bayes-platform),
with one intentional divergence: inference is local rather than hosted.

## Stack

| Concern | Choice |
|---|---|
| Language | TypeScript |
| API | NestJS + TypeORM |
| Database | PostgreSQL 17 + pgvector |
| Monorepo | Turbo + npm workspaces |
| Lint / format | Biome |
| Inference | Gemma 4 via llama.cpp (OpenAI-compatible endpoint) |
| Embeddings | EmbeddingGemma-300m |

No LangChain or LlamaIndex — deliberately. They hide the mechanics this project exists to learn.

## Prerequisites

- Node.js ≥ 18 and npm ≥ 10.5
- Docker
- [llama.cpp](https://github.com/ggml-org/llama.cpp) (`brew install llama.cpp`) — not yet required
  by the API, but needed from week 1 onwards

## Getting started

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:up
npm run dev
```

Then check it's alive:

```bash
curl -i localhost:3000/health
```

You should get `200` and a body reporting the database as `up`. To confirm the health check is
real rather than decorative, stop the database and try again — it should return `503`:

```bash
npm run db:down
curl -i localhost:3000/health
```

## Commands

| Command | Does |
|---|---|
| `npm run dev` | start everything in watch mode |
| `npm run build` | build all workspaces, in dependency order |
| `npm run test` | run tests |
| `npm run check` | lint and format check (read-only) |
| `npm run check:fix` | apply safe lint and format fixes |
| `npm run db:up` | start Postgres |
| `npm run db:down` | stop Postgres (data is preserved) |

`npm run db:down -- -v` would also delete the volume, destroying the databases.

## Structure

```
apps/
  api/        NestJS — agent runtime, tools, retrieval, guardrails
packages/     shared types, eval harness  (not yet created)
infra/
  database/   Postgres 17 + pgvector, and its init script
```

Further apps (`web`, `mcp-server`, `workers`) arrive in later weeks.

## Database

Postgres 17 with pgvector, in Docker. Two databases are created on first start: `entitle` and
`entitle_test`. pgvector is enabled in both — extensions are per-database, not per-server.

```bash
docker compose -f infra/database/docker-compose.yml exec -it postgres psql -U admin -d entitle
```

`\l` lists databases, `\dx` shows installed extensions, `\q` quits.

The credentials in `docker-compose.yml` are for a container bound to localhost only. Anything
genuinely secret belongs in `.env`, which is not committed.

## Licence

MIT.
