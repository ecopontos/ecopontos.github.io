# EcoForms

Sistema completo de formulários ecológicos — coleta de dados em campo (mobile/Android) com
gestão, sincronização e relatórios em um app desktop (Tauri + Next.js).

## Estrutura do monorepo

```
ecoforms0/
├── desktop/        # App desktop (Tauri v2 + Next.js, Clean Architecture)
├── mobile/         # App Android (Capacitor v8) — coleta de dados em campo
├── packages/core/  # ecoforms-core — biblioteca compartilhada (permissões, sync, utils)
├── supabase/       # Migrações SQL e configuração do backend Supabase
└── docs/           # Documentação consolidada (ADRs, auditorias, schema)
```

Cada workspace tem seu próprio README com instruções específicas:

- [`desktop/README.md`](desktop/README.md)
- [`mobile/README.md`](mobile/README.md)

Para diretrizes de desenvolvimento orientadas a agentes (convenções de arquitetura, banco de
dados, sincronização, RBAC, etc.), veja [`CLAUDE.md`](CLAUDE.md).

## Pré-requisitos

- **Node.js** 20+ e npm (workspaces)
- **Rust** + toolchain do [Tauri v2](https://v2.tauri.app/) — necessário para rodar/compilar o app desktop
- **Android SDK** + JDK — necessário para compilar o app mobile (APK)

## Instalação

```bash
npm install
```

O `npm install` na raiz resolve as dependências de todos os workspaces (`desktop`, `mobile`,
`packages/core`).

## Comandos rápidos (raiz)

```bash
npm run desktop             # inicia o Next.js dev server do desktop (porta 3001)
npm run mobile:serve        # inicia o servidor de desenvolvimento mobile (porta 5502)
npm run build:desktop       # build de produção do desktop (Next.js)
npm run build:mobile        # build de produção do mobile (CSS + assets)
npm run build:mobile:debug  # build mobile + sync Capacitor + APK debug
npm run test:desktop        # testes do desktop (vitest)
npm run test:mobile         # testes do mobile (vitest)
```

Para detalhes de cada comando (incluindo o app Tauri completo e geração de APK), consulte os
READMEs de cada workspace.
