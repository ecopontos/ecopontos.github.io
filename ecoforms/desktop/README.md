# EcoForms — Desktop

App desktop do EcoForms: **Tauri v2 + Next.js 16**, organizado em Clean Architecture
(`domain/` → `application/` → `infrastructure/` → `interface`/UI).

## Pré-requisitos

- Node.js 20+ (instale as dependências a partir da raiz do monorepo: `npm install`)
- Rust + toolchain do [Tauri v2](https://v2.tauri.app/) (necessário para `start:tauri` e
  `build:tauri`)

## Como rodar

```bash
npm run dev          # Next.js dev server isolado, porta 3001 (sem o shell Tauri)
npm run start:tauri  # Next.js (porta 3001) + Tauri dev em paralelo — app desktop completo
```

## Build de produção

```bash
npm run build:tauri  # next build + tauri build → binário/instalador desktop
```

## Testes

```bash
npm test             # vitest run — testes TypeScript (src/**/*.test.{ts,tsx})
```

Backend Rust (em `src-tauri/`):

```bash
cd src-tauri
cargo test --lib     # testes da crate de biblioteca (app_lib)
```

> `cargo test` (sem `--lib`) falha em ambiente Windows por um conflito de manifesto entre o
> `tauri_build` e o `build.rs` deste projeto ao linkar o binário de teste — use sempre
> `cargo test --lib`.

## Lint

```bash
npm run lint         # ESLint
```

## Banco de dados (SQLite local)

O schema é definido em `scripts/ensure-columns.ts` — única fonte de verdade (`CREATE TABLE IF
NOT EXISTS` + `ADD COLUMN` + seed de dados). Ele roda automaticamente no boot via `container.ts`
(`ensureColumnsIfNeeded`), mas também pode ser executado manualmente para iterar no schema:

```bash
npx ts-node scripts/ensure-columns.ts
```

Qualquer nova coluna deve ser adicionada **tanto** em `scripts/ensure-columns.ts` **quanto** em
`docs/db/schema_consolidado_corrigido.sql` (referência documental).

## Mais informações

Convenções de arquitetura, autenticação, sincronização, RBAC e demais detalhes do projeto estão
documentados em [`CLAUDE.md`](../CLAUDE.md) (raiz do monorepo).
