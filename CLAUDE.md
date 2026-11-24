# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Implementation follows the instructions in `instructions/` in order (0001 → 0009); each starts only when the user asks.

- `references/SPEC.md` — the agreed specification v2 (2026-11-24) and the source of truth for what to build. `references/SPEC_ko.md` is its Korean translation; keep the two in sync. If the implementation needs to differ from the spec, ask before changing either.
- `agent-harness-tui` — the companion client (a separate Rust project). It is **not** in this repo; it generated `harness.toml`, `harness.lock.json`, `instructions/agent-db.*` and the managed block below. When available, run it from the project root; it never searches parent dirs, inits Git, commits, or pushes.
- `CLAUDE_ko.md` — the Korean counterpart of this file. Guidance documents come in English/Korean pairs, so mirror changes made outside the managed block there.

## Commands

Node ≥ 24.15 runs the TypeScript sources directly (type stripping) — there is no build step. Use only erasable TypeScript syntax (no enums, namespaces or parameter properties) and import local files with the `.ts` extension.

```sh
npm install
npm run dev          # node --watch src/main.ts
npm start            # node src/main.ts (HCS_BIND=host:port, default 127.0.0.1:7878)
npm run typecheck    # tsc --noEmit
npm run lint         # biome check .   (npm run format to apply formatting)
npm test             # node --test 'src/**/*.test.ts'
npm run check        # typecheck + lint + test
node --test src/http/app.test.ts                          # one test file
node --test --test-name-pattern='health' 'src/**/*.test.ts'   # tests by name
```

Tests use `node:test` + `node:assert`; HTTP handlers are tested in-process with Hono's `app.request()`.

## Code layout

- `src/main.ts` — process entry: loads config, starts the Hono app on `@hono/node-server`.
- `src/config.ts` — configuration from `HCS_*` environment variables.
- `src/http/app.ts` — `createApp()` builds the Hono app; REST (`/v1`), MCP and web UI API (`/ui/api`) are mounted here as they are added.
- Planned (per instructions): `src/storage/` (SQLite via `node:sqlite`), `src/domain/` (items, revisions, tags), `src/auth/`, `src/mcp/`, and the web UI.

## What this service is

"Harness contents service": a multi-team service that stores and serves the **skills, references and guidance docs** that project agents use, outside Git, with permissions and version history. It only provides content; reflecting it into project files (stubs, guidance blocks) is the client's (`agent-harness-tui`) job.

Key terms: a **content repository** is the unit of sharing and visibility (`private`/`public`); an **item** is one `skill` (`SKILL.md` + supporting files such as scripts), `reference` or `guidance` doc; every save creates an immutable **revision**; **tags** point at revisions and `latest` always points at the newest (docker-style); a **project** is a consumer namespace mapped to one target Git repository and is granted `read`/`write` access to repositories.

## Planned design (spec v2, 2026-11-24)

- One server program, one admin (v1). Three entry points over the same handlers and permission checks: web UI (default for humans), REST API v1, MCP (read tools, plus write tools for write tokens).
- Tokens are issued by the server and stored only as hashes: project tokens with `read` or `write`, and an admin token. Anonymous access reads only `public` repositories. Auth failure and not-found return the same `404`.
- Attributes: free-form md frontmatter key/values plus fixed `tags` and `version`. Reads default to `latest`; `ref` selects a tag or revision. `ETag` identifies a revision; writes require `If-Match`.
- Items are addressed as `<repository UUID>/<item UUID>@<ref>`; no `@` means `latest`. Aliases are search-only (non-unique); identifiers, paths, aliases and tags compare case-insensitively. Changing frontmatter `version` auto-creates a version tag. Deletion is soft. Reuse is mainly by fork.
- Storage: SQLite (WAL) with content-addressed (sha256) text blobs. The admin logs in with the `HCS_ADMIN_PASSWORD` env var and receives a server-generated, expiring admin token (Bearer header); the password is never stored. Admin tokens are for the web UI only (`/ui/api/*`; REST and MCP reject them), last 12 h, no rotation. Project tokens are never rotated: expiry (or none) is fixed at creation; the admin can revoke them. Admin features exist only in the web UI. Auth failures are logged in a fixed one-line format for fail2ban (spec §8-1). Soft delete only. Implementation: Node + TypeScript (stack in spec §11).
- Catalog JSON and the client-side initial config (old §8-1) are dropped. Verify MCP transport and auth handling against the latest official MCP spec before implementing — do not guess.

## Invariants to preserve

- The server never executes shell commands or stored scripts; it only stores and serves them.
- Tokens are stored hashed only; never log tokens or content bodies.
- Stubs never contain bodies; fetched bodies are never stored in Git-tracked paths (client-side rule).

## Open questions (see spec §12)

Adjust MCP once its transport and auth are verified against the official spec; pick the SQLite driver and HTTP framework at implementation start. Don't settle these unilaterally — ask.

<!-- agent-harness:begin agent-harness -->
## Agent harness

Generated by agent-harness-tui from `harness.toml`. Edit text outside this block; changes inside it are reported as conflicts.

### Paths

- `instructions/`: active work instructions.
- `instructions/.completed/<UUID>.md`: completed instructions.
- `instructions/completed.log`: completion log, append-only.
- `references/`: reference documents.
- `.skills/<id>/`: canonical skill packages. Read `SKILL.md` there when its topic comes up; listing a path here does not make an agent discover it automatically.
- `.output/`: generated output. One-way: never read it back as input. Not tracked by Git.
- `instructions/agent.db`: backlog (`backlog` table) and instruction status (`instructions` table), not tracked by Git. Manage it with `bash instructions/agent-db.sh <command>` or `pwsh -File instructions/agent-db.ps1 <command>` (run without arguments for the command list; needs the `sqlite3` CLI). `instructions/completed.log` stays the source of truth for completed instructions: the scripts only append to it and sync the database from it. Set `AGENT_DB_ACTOR` to record who made a change. Do not change the schema.

### Instructions

- One instruction per file: `instructions/NNNN_short-name.md`, where `NNNN` is a 4-digit sequence starting at `0001`.
- Instructions are Markdown written in Korean only and are never translated. English/Korean pairs apply only to references, skills and guidance documents.
- The header holds a fixed UUID and a status (`TODO`, `IN_PROGRESS`, `DONE`):

  ```markdown
  # 0001 — <title>

  > UUID: <uuid>
  > Status: TODO
  ```

- UUIDs must be unique across independent working copies. `NNNN` and the log's line order are local order only, not a global number or timeline across branches.
- An instruction is complete only when the user explicitly says so; an agent's reply or the end of a session never counts. On completion set `DONE`, move the file to `instructions/.completed/<UUID>.md`, and append one line to `instructions/completed.log`.
- Log line format: `UUID | summary | datetime with offset`, e.g. `2026-11-16 14:00:00 +0900`.
- Never truncate, rewrite, reorder or renumber the log. On a merge conflict, show it to the user instead of silently dropping history.

### Git

- Track `instructions/` (with `instructions/.completed/` and `instructions/completed.log`), `references/`, `.skills/`, `harness.toml`, `harness.lock.json` and the root guidance files.
- Ignore `.output/`, `.harness/` and `instructions/agent.db`, `instructions/agent.db-wal`, `instructions/agent.db-shm`, `instructions/agent.db-journal`. Never put credentials in tracked files.

### Skills

- Claude Code: each skill is copied from `.skills/<id>/` to `.claude/skills/<id>/`, where Claude Code discovers it. Edit `.skills/`, not the copies: copies are regenerated and not tracked by Git.
- None selected yet.

This guidance states policy. It does not enforce file system or command permissions by itself.
<!-- agent-harness:end agent-harness -->
