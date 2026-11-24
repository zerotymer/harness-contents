# Harness Contents Service — Specification v2

> Status: agreed v2 (2026-11-24). Replaces the v1 draft (2026-11-23), which described a read-only file server, with a **content repository that has permissions and version history**.
> Korean translation: `SPEC_ko.md`. This English document is authoritative; keep the two in sync. Implementation is on hold until explicitly requested.

## 0. Changes from the v1 draft

- Catalog JSON (`catalogs/`, `/catalogs/{kind}`, the catalog convention) is dropped.
- Client initial configuration (old §8-1: `project.json`, `default.json`, the connection screen) belongs to `agent-harness-tui` and is removed from this document.
- Read-only → write API, version history, and permission/token management are now in scope.
- Storage: directory tree → SQLite.
- Tokens: env-var injection → issued by the server and stored only as hashes. The admin logs in with a password from an env var and receives a token.

## 1. Purpose

Manage and serve the **skills, references and guidance docs** that project agents use, outside Git and dynamically. The service only provides content. Reflecting it into project files (creating stubs, updating guidance blocks, etc.) is the client's (`agent-harness-tui`) job.

| Sharing channel | What |
| --- | --- |
| Git | Guidance, skills and references that may be public |
| Environment variables (shared separately) | Secrets, service tokens |
| **This service** | Skills, references and guidance whose sharing scope must be controlled or that must be fetched live (dynamic) |

## 2. Terms

- **Content repository (repository):** a collection of content; the unit of sharing and visibility. (Called a "content repository" to distinguish it from a Git repository.)
- **Item:** one piece of content in a content repository, identified by a **UUID**. There are three kinds:
  - `skill`: a bundle of `SKILL.md` and supporting files (scripts, etc.).
  - `reference`: one md document.
  - `guidance`: one guidance md document.
- **Alias:** a **search-only** name. A target can have several, and they may overlap with other targets. Aliases are never used for identification; the identifier is always the UUID.
- **Revision:** an immutable snapshot of an item. Numbered from 1, incremented on every save.
- **Version tag:** a name pointing at a revision. `latest` is reserved and always points at the newest revision (docker-tag style). Not the same as the search attribute `tags` (§4-1).
- **Project:** the consumer-side namespace. Maps to one target Git repository.
- **Grant:** a record of which content repository a project may read or write.
- **Token:** an access key issued by the server.
- **Dynamic skill / dynamic reference:** a skill or reference whose body lives only on the service. The project holds only a stub or a listing.

## 3. Deployment

- A service shared by multiple teams. One server program.
- There is **one admin** (v1), who manages projects, repositories, grants and tokens. The bottleneck this creates as teams grow is accepted.
- Three entry points, all using the same handlers and **the same permission checks**: **web UI (browser), REST API, MCP.** Writing through any of them requires a `write` token. Admin tokens are used only in the web UI (§5).
  - Humans edit in the web UI by default. Agents read through REST or MCP and write when permitted (where versions are bumped and released differs per team, so all three entry points support writes).
- Binds to `127.0.0.1` by default. External exposure only when configured explicitly; TLS is handled by a reverse proxy.

## 4. Data model

| Entity | Main fields |
| --- | --- |
| Repository | `id` (UUID), `aliases[]`, `visibility` (`private` \| `public`), `description`, `created_at`, `deleted_at` |
| Item | `id` (UUID), `repository_id` (never changes), `kind`, `aliases[]`, `forked_from` (repository/item/revision, optional), `created_at`, `deleted_at` |
| Revision | `item_id`, `rev`, `files[]` (`path` (original file name, e.g. `scripts/run.js`), `sha256`, `size`, `script_lang`), `attributes`, `message`, `author_token_id`, `created_at` |
| Blob | `sha256` → body (UTF-8 text). Identical content is stored once |
| VersionTag | `item_id`, `name`, `rev` |
| Project | `id` (UUID), `aliases[]`, `description`, default repository |
| Grant | `project_id`, `repository_id`, `access` (`read` \| `write`) |
| Token | `id`, `hash`, `scope` (`admin` \| `project`), `project_id`, `access` (`read` \| `write`), `label`, `source` (`issued` \| `admin_login`), `expires_at`, `revoked_at`, `last_used_at` |
| Audit | time, token id, action, target. Never bodies or token values |

### 4-1. Names and attributes

- Storage names and request names are **UUIDs**. Aliases are for search only and may overlap.
- **Case:** identifiers (UUIDs), file paths within an item, aliases, `tags` and version tags are all compared **case-insensitively**. UUIDs are normalized to lower case on storage. File paths and aliases are displayed as entered, but two paths differing only in case cannot coexist in one item.
- **Character rules for aliases, `tags` and version tags:** Hangul, Latin letters, digits, space, and the common symbols `- _ . ( ) + #`. 1–64 characters. Normalized to Unicode NFC and trimmed before storage. `/` and `@` (used in the address syntax) and control characters are not allowed. (Version tags may not contain spaces, and all-digit names are not allowed because they would clash with revision numbers.)
- **Fixed attributes:** `tags` (list of strings for search), `version` (human-assigned version label, e.g. `1.2.0`).
- **Free attributes:** the remaining key/values of the md frontmatter, extracted into `attributes` on save. The frontmatter in the body is the source of truth.
- A `skill`'s `SKILL.md` frontmatter must have `name` and `description`. `name` is registered automatically as an alias of the item.
- Search is by **alias and `tags`** (with filtering by kind and attributes). Results are UUID lists; follow-up requests use UUIDs. No full-text search.

### 4-2. Versions

- Every save creates a new revision. Earlier revisions never change.
- The address format is `<repository UUID>/<item UUID>@<ref>`, where `<ref>` is a version tag or a revision number. **Without `@`, it means `latest`.**
  - Examples: `<repo>/<item>`, `<repo>/<item>@latest`, `<repo>/<item>@1.2.0`, `<repo>/<item>@7`
  - Items are never moved to another repository (fork instead), so addresses never change.
- Saving a revision whose frontmatter `version` changed **automatically creates** a version tag with that name. If the name already points at another revision, the save is rejected (version tags never move, except `latest`).
- `ETag` identifies a revision. Reads honour `If-None-Match`; writes require `If-Match` so nobody overwrites someone else's change.
- Reverting means creating a new revision with the content of an earlier one.
- Deletion is **soft delete only** (`deleted_at`). Deleted items drop out of listings and search; only the admin can see them by UUID. They can be restored. There is no permanent deletion (to be added as a separate feature if needed).

### 4-3. Sharing and reuse

- The unit of sharing is the **content repository**. Granting the same repository to several projects lets them share a single original.
- `public` repositories can be read by anyone without a token.
- Creating a project creates a dedicated default repository for it, granted with `write`.
- The primary means of reuse is **forking**: copy a shared or public item into your own repository as a new item (new UUID) and record its origin (`forked_from`). When the original gets a new revision, the fork can see it (a human decides whether to update).
- Aliases are search-only, so overlapping aliases cause no resolution conflict. If several items share an alias, all appear in search results.

## 5. Permissions and tokens

| Principal | Can |
| --- | --- |
| No token | Read `public` repositories, `/health` |
| Project token `read` | Read granted repositories and `public` repositories |
| Project token `write` | `read` + create, update, delete and fork items in repositories granted with `write` |
| Admin token (issued by password login, **web UI only**) | Everything: manage projects, repositories, grants and tokens; restore deleted items |

- Project-token permissions apply identically in the web UI, REST and MCP. **Admin tokens are accepted only by the web UI API (`/ui/api/*`); REST (`/v1/*`) and MCP reject them.**
- Requests use `Authorization: Bearer <token>`. **The web UI uses the same header:** the token entered at login is kept in tab memory (or `sessionStorage`) and sent as a header on every request. No cookies are used, so no CSRF protection is needed. In exchange, the md preview must always be sanitized to prevent script injection (XSS).
- A project token's value is shown once, at issuance. The server stores only its hash. Expiry: §5-2.
- "Not permitted" and "not found" return the same `404` so private targets' existence is not revealed.

### 5-1. Admin login

- The admin password is provided only through the `HCS_ADMIN_PASSWORD` environment variable. It is never written to a file or stored in the database.
- The admin logs in from the web UI with the password (`POST /ui/api/admin/login`) and receives an **admin token generated by the server**. The web UI then sends this token in the `Authorization: Bearer` header.
- Admin tokens are stored only as hashes and expire after **12 hours**. There is no rotation; log in again after expiry. On server restart, all previously issued admin tokens are revoked (so a password change takes effect immediately).
- Password comparison is constant-time. The password must be **at least 8 characters**, checked at startup. Failed logins are answered after a fixed delay and logged in a fixed format so fail2ban can ban the source (§8-1).
- If `HCS_ADMIN_PASSWORD` is missing or shorter than 8 characters, the server still starts but admin login is disabled (with a warning). Reads and writes continue to work with existing project tokens.

### 5-2. Project token expiry

- Project tokens are **never rotated.**
- The expiry date is set **at creation** and may be unlimited. Until then the token keeps working.
- The expiry date cannot be changed after creation. To extend, create a new token.
- The admin can revoke tokens in the web UI (for leak response).

## 6. Entry points

### 6-1. REST API v1

`{repo}` and `{item}` are UUIDs. `{item}` may be followed by `@<ref>` (default `latest`).

| Method & path | Content | Permission |
| --- | --- | --- |
| `GET /health` | Status, service version | none |
| `GET /v1/projects/{pid}/items?kind=&alias=&tag=&attr.<key>=` | Items visible to the project | read |
| `GET /v1/repos/{repo}/items/{item}` | Item metadata and file list (`path`, `sha256`, `size`, `script_lang`) | read |
| `GET /v1/repos/{repo}/items/{item}/files/{path}` | File body (`text/plain; charset=utf-8`) | read |
| `GET /v1/repos/{repo}/items/{item}/revisions` | Revision history | read |
| `POST /v1/repos/{repo}/items` | Create item | write |
| `PUT /v1/repos/{repo}/items/{item}` | Save a new revision (`If-Match` required) | write |
| `POST /v1/repos/{repo}/items/{item}/fork` | Fork | write |
| `DELETE /v1/repos/{repo}/items/{item}` | Soft delete | write |

- REST accepts only project tokens (or no token, for reading `public`). Management functions are not in REST; they exist only in the web UI.
- Errors are `application/problem+json`.
- File paths are normalized; `..` and absolute paths are rejected.

### 6-2. MCP

- Thin tools over the same handlers:
  - Read: `list_items` (filter by kind, alias, `tags`, attributes), `get_item`, `get_item_file`, `list_revisions`
  - Write (`write` tokens only): `put_item`, `fork_item`
- The visible tools depend on the token's permissions.
- **Addresses are a single string** (`address`): `<repository UUID>/<item UUID>[@<ref>]`. Every `list_items` result includes the complete `address` so agents can copy it verbatim. Tool input schemas carry a regex `pattern` to reject malformed addresses early. It is the same syntax as the REST path, so docs and logs use one form.
- Verify the transport (HTTP-based) and auth-header handling against the **latest official MCP specification before implementing.** Do not guess.

### 6-3. Web UI

- Admin: manage projects, repositories, grants and tokens; restore deleted items; edit content.
- The web UI uses its own API `/ui/api/*`, which accepts both admin and project tokens.
  - `POST /ui/api/admin/login`: issue an admin token for the password (no permission needed)
  - `/ui/api/admin/{projects,repos,grants,tokens}`: management (admin)
  - Content reads and writes use the same handlers as REST.
- `/ui/api/*` is not a public contract. It is unversioned and changes together with the web UI. (Note: it is reachable over HTTP, so someone holding an admin token can call it directly. The split marks the intended scope — admin tokens are not for automation — and is not a security mechanism.)
- `write` permission: edit md, add files, compare revisions (diff), fork, revert, delete.
- The md editor and diff view use external libraries (§11).

## 7. Storage

- **SQLite (WAL)** holds both metadata and bodies. Bodies are stored content-addressed by sha256 to remove duplicates.
- One writer at a time (an SQLite property), which is enough for human editing rates. Multiple servers and high availability are out of scope for v1.
- Only text (UTF-8) is stored. No bulk import/export (back up the SQLite file).
- File bodies live inside the database, so no executable files ever appear on the server's disk. The original file name is stored separately in `path`.

### 7-1. Size limits (defaults, configurable)

| Target | Default | Rationale |
| --- | --- | --- |
| One file | 1 MiB (warning above 256 KiB) | md documents are usually a few KB to tens of KB. 256 KiB is roughly tens of thousands of tokens — already large to put into an agent's context at once |
| One item (all files) | 5 MiB | Enough for a skill body plus several scripts |
| Files per item | 100 | |
| Frontmatter | 64 KiB | Attributes should be short values |
| Aliases, `tags`, version tags | 1–64 characters; up to 32 `tags` and 16 aliases per item | |
| Request body | Item limit + margin (6 MiB) | |

## 8. Security principles

- The server never runs shell commands and never executes scripts. It only stores and serves them.
- **Scripts:** allowed in any language. Each file stores its language (`script_lang`, e.g. `js`) and original file name (`path`); bodies are always served as `text/plain`. The server never executes them.
- The server provides a **hash and revision** for every file. Review before execution is enforced by the executing side (client/agent), e.g. re-review before running whenever the hash differs from the last reviewed one.
- Tokens are stored only as hashes. Never log tokens, passwords or bodies.
- Client-side principles (for reference): stubs never contain bodies; fetched bodies are never stored in Git-tracked paths.

### 8-1. Authentication failure log (for fail2ban)

Every authentication failure is logged as **one line** in the format below. The format is fixed; changing it is a compatibility break.

```
<ISO8601 UTC time> hcs auth_failed ip=<client IP> kind=<admin_login|bearer> path=<request path>
```

Example:

```
2026-11-24T07:30:00.123Z hcs auth_failed ip=203.0.113.5 kind=admin_login path=/ui/api/admin/login
```

- `admin_login`: wrong password. `bearer`: missing, expired or revoked token, or an admin token sent to REST/MCP. (The response is `404` per §5, but the log records a failure.)
- Never include passwords, token values or bodies.
- Logs go to standard output. If `HCS_LOG_FILE` is set, they are also written to that file (so fail2ban can read either the file or the systemd journal).
- Behind a reverse proxy, `X-Forwarded-For` is trusted only for requests coming from addresses listed in `HCS_TRUSTED_PROXIES`; otherwise the connecting IP is used (so the proxy's own IP is not banned).

Example fail2ban configuration:

```ini
# /etc/fail2ban/filter.d/hcs.conf
[Definition]
failregex = ^\S+ hcs auth_failed ip=<HOST> kind=\S+ path=\S+$
datepattern = ^%%Y-%%m-%%dT%%H:%%M:%%S

# /etc/fail2ban/jail.d/hcs.conf
[hcs]
enabled  = true
filter   = hcs
logpath  = /var/log/hcs/hcs.log
maxretry = 5
findtime = 10m
bantime  = 1h
```

## 9. Out of scope (v1)

Multiple admins, per-team admin delegation, permanent deletion, rate limiting, per-project storage quotas, SSO/OAuth login, binary files, server-side script execution, full-text search, bulk import/export, multiple servers/high availability, WebDAV, remote sync, wiki (md-gw) proxy, catalog JSON.

## 10. Decision record (2026-11-24)

- Catalogs and old §8-1 are dropped.
- One admin; the limitation is accepted. Tokens are per project, `read`/`write`.
- The unit of sharing is the content repository. `public` visibility is supported. Reuse relies heavily on forking.
- Write entry points: web (default), REST API, MCP. Writes require a `write` token on every entry point.
- Attributes: frontmatter-based (free) + fixed (`tags`, `version`). Changing `version` auto-creates a version tag.
- The service only provides content.
- A service shared by multiple teams.
- Address is `<repository UUID>/<item UUID>@<ref>`; without `@`, `latest`. Versioning is per item.
- Storage is SQLite.
- The admin logs in with `HCS_ADMIN_PASSWORD`; admin tokens are generated by the server (Bearer header).
- Soft delete only. Permanent deletion would be a separate feature.
- No per-project quotas and no rate limiting.
- Implementation language: Node (TypeScript). The tech stack is fixed per §11 (versions and status checked at implementation start).
- Admin tokens: web UI only, 12 hours, no rotation (log in again on expiry).
- Project tokens: no rotation. Expiry set at creation (unlimited allowed); usable until then. The admin can revoke them.
- Management functions exist only in the web UI (`/ui/api/*`), not in REST or MCP.
- Admin password at least 8 characters. Instead of rate limiting, authentication failures are logged in a fixed format for fail2ban.
- MCP addresses are a single string (`address`).
- Identifiers are UUIDs. Aliases are search-only, multiple and overlapping allowed. Search by alias and `tags`. No bulk import/export.
- Identifiers, paths, aliases and tags are case-insensitive. Aliases allow Hangul, Latin letters, digits and common symbols.
- Scripts in any language. Original file names stored separately. The server provides only hash and revision; the executing side enforces review.
- The web UI uses the Bearer header without cookies (no CSRF protection needed).
- Default size limits: §7-1.

## 11. Tech stack (fixed; check versions and status at implementation start)

| Purpose | Choice | Note |
| --- | --- | --- |
| Language & runtime | Node LTS + TypeScript | |
| HTTP server | Hono or Fastify | Lightweight, TypeScript-friendly |
| SQLite | `better-sqlite3` or built-in `node:sqlite` | Check `node:sqlite` stability before choosing |
| MCP | Official TypeScript SDK | Verify transport and auth against the latest spec |
| md editor | CodeMirror 6 | Lightweight, has an md mode |
| md rendering + sanitizing | markdown-it + DOMPurify | Prevents XSS in previews |
| Diff view | jsdiff (+ diff2html) | Revision comparison |

## 12. Open questions

1. Verify the MCP transport and auth handling against the latest official specification at implementation start, and adjust §6-2 accordingly.
2. Pick one SQLite driver (`better-sqlite3` / `node:sqlite`) and one HTTP server (Hono / Fastify) at implementation start.
