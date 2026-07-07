# Root Artifact Inventory - 2026-07-07

## Workspace Boundary

`ecoforms/package.json` declares exactly these npm workspaces:

- `desktop`
- `mobile`
- `packages/core`

Root-level artifacts outside those directories are not part of the declared npm workspace boundary unless a script, import, runtime operation, or explicit owner proves otherwise.

## Classification Rules

- `main-workspace`: artifact belongs to one of the declared workspaces or is directly required by workspace scripts/builds.
- `lateral-tool`: standalone tool or operational entrypoint outside the declared workspaces, with its own runtime script, server entrypoint, or package metadata.
- `tracked-orphan`: tracked artifact outside the declared workspace boundary with insufficient evidence to remove safely; requires owner/history/import audit before move or removal.
- `candidate-remove`: artifact with strong evidence of no imports, scripts, runtime owner, or operational use. This inventory does not classify any required artifact as `candidate-remove`.

## Evidence Summary

- Root scripts in `ecoforms/package.json` delegate only to `desktop`, `mobile`, and `packages/core`.
- Required reference search was run with `rg -n "server\.js|meu-supabase-mcp|app/login|default/vitest|src/index|supabase-mcp-connector" ecoforms`.
- Search results include prior docs and plans referencing these artifacts, but no root workspace script proves active build ownership for `src/`, `app/login/page.tsx`, or `default/vitest.config.js`.
- `git ls-files -- ecoforms/server.js ecoforms/meu-supabase-mcp ecoforms/src ecoforms/app/login/page.tsx ecoforms/default/vitest.config.js` confirms all required artifacts are tracked.

## Inventory

| Artifact | Evidence | Classification | Decision |
| --- | --- | --- | --- |
| `server.js` | Tracked root file. First ~80 lines show an Express app, static serving from `www`, `/health`, `/api` rate limiting, API-key protection, and Supabase service-role configuration. It is outside declared workspaces and not referenced by root package scripts. Prior docs mention it as an Express proxy/bridge. | `lateral-tool` | Keep. Treat as a standalone operational entrypoint until an owner confirms replacement or retirement. Do not remove in workspace cleanup. |
| `meu-supabase-mcp/` | Tracked directory with its own `package.json`, `package-lock.json`, `.env.example`, `mcp-server.js`, and `src/index.js`. Package scripts include `start`, `dev`, and `mcp`; package main is `src/index.js`. It is not listed in root workspaces. | `lateral-tool` | Keep. Treat as an isolated MCP/Supabase tool; if retained, document owner and install/run flow separately from npm workspaces. |
| `src/` | Tracked root source tree includes `src/index.js`, `src/supabase-client.js`, `src/supabase-mcp-connector.js`, domain/application/infrastructure TypeScript files, and SQLite repository files. `src/index.js` is a CommonJS Supabase Storage query script. `supabase-mcp-connector.js` exports `SupabaseMcpConnector`. No root package script points at this tree. Prior ADRs call it root DDD/source artifact and require inventory before cleanup. | `tracked-orphan` | Do not mark safe to remove. Audit imports, history, and ownership; then either move live code into the owning workspace/tool or archive/remove in a dedicated PR with evidence. |
| `app/login/page.tsx` | Tracked root Next/Tauri login page. It imports `@/contexts/AuthContext`, UI components, `@/src/interface/hooks/catalog/tauri`, `ConsolePanel`, and `FirstRunSetupModal`; it invokes local database/password commands. It is outside declared workspaces. Search results show prior ADR/plan references, including desktop-related login migration notes, but no root workspace script ownership. | `tracked-orphan` | Do not remove based on boundary alone. Compare with `desktop/app/login/page.tsx`, audit path aliases/import owners, and decide whether to move, deduplicate, or archive in a separate PR. |
| `default/vitest.config.js` | Tracked file containing only `import config from '../vitest.config.js'; export default config;`. It is outside declared workspaces and no root package script references `default/vitest`. Search results only show cleanup/inventory references. | `tracked-orphan` | Keep until test invocation history is checked. If no runner or CI path uses `default/vitest.config.js`, propose archive/removal in a focused cleanup PR with command evidence. |
