# EcoForms — Mobile

App Android do EcoForms para coleta de dados em campo: **Capacitor v8**, com `www/` como
`webDir` (HTML/JS/CSS puro, sem framework de build de UI). RBAC é enforced apenas no frontend
(sem commands Rust, ao contrário do desktop).

## Pré-requisitos

- Node.js 20+ (instale as dependências a partir da raiz do monorepo: `npm install`)
- Android SDK + JDK — necessário para `build-debug`/`debug-mobile` (geração de APK)

## Como rodar (dev web)

```bash
npm run build   # build CSS (Tailwind) + concat + sync-field-css
npm run serve   # dev server em http://localhost:5502 servindo mobile/www/
```

## Build / APK debug

```bash
npm run debug-mobile  # build + cap sync + abre o Android Studio
npm run build-debug   # build + cap sync + gradlew assembleDebug → gera o APK debug
```

## Testes

```bash
npm test            # vitest run (uma vez, sai com 0/1)
npm run test:watch  # vitest em modo watch (interativo)
```

## Mais informações

Detalhes sobre o pipeline de sincronização (eventos, criptografia, IndexedDB), estrutura de
módulos e demais convenções do projeto estão documentados em [`CLAUDE.md`](../CLAUDE.md) (raiz
do monorepo).
