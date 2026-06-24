# Código Morto — inventário e remoção

> **Status: CONCLUÍDO** (2026-06-09). Levantamento original em 2026-06-08.
> Execução em 2026-06-09 — itens ALTA confiança removidos. Itens MÉDIA requerem decisão humana.

## Resultado da execução (2026-06-09)

| # | Item | Status |
|---|------|--------|
| 1 | `mobile_standalone/` | ⚠️ Vazio (robocopy). Diretório bloqueado por processo externo. Executar `rmdir /s /q mobile_standalone` após fechar VS Code/Explorer. |
| 2 | `download/` (12 MB) | ✅ Removido |
| 3 | `*.v2` órfãos (11 arquivos) | ✅ Removidos. `CheckboxField.v2.js` preservado (vivo). |
| 4 | `archive/` CSS | ✅ Removidos |
| 5 | `download/indexeddb_leveldb/LOG.old` | ✅ Removido junto com #2 |
| 6 | `desktop/tsconfig.json` excludes | ✅ Limpos |
| 7 | `_analysis_output.json` | ✅ Removido |
| 8-10 | MÉDIA confiança | ⏳ Pendentes — requerem decisão |

Convenção de confiança:
- **ALTA** — zero referências no código ativo; remoção segura após sanity check.
- **MÉDIA** — referenciado só por páginas de teste/dev ou nome sugere obsolescência; revisar antes.

---

## ALTA confiança

### 1. `mobile_standalone/` — fork/snapshot duplicado inteiro
- **7,7 MB · 453 arquivos** (inclui `android/`, `package-lock.json`, `www/` com 226 JS vs 106 do `mobile/`).
- **Não é workspace**: `package.json` raiz declara só `["desktop", "mobile", "packages/core"]`.
- **Zero referências no código ativo.** Único mencionado em 3 ADRs antigos (`docs/Anteriores/2026-05-2x-*.md`).
- Contém telas já removidas do produto: `clientes.html`, `cliente-form.html`, `cliente-detalhe.html`, `coletas.html`, `demandas.html`, `demanda-detalhe.html`, `export.html` — corresponde aos domínios `client/`/`crm/`/ouvidoria já consolidados.
- **Veredito**: snapshot congelado. Candidato #1 a enterro (mover para fora do repo ou deletar).

### 2. `download/` — despejos de dados / backups (~12 MB)
- `EcopontosConsolidados.xlsx` (2,9 MB), `tbl_suite_export.json` (5,5 MB), `formSubmissions.json` (1,3 MB), `formSubmissions_ERROS_*.json`, `indexeddb_backup.tar`, `indexeddb_leveldb/`, `indexeddb_raw/`, `inserir_erros_supabase.sql`, `atendimentos_ecoponto.csv`.
- Única "referência" (`desktop/src/test/fakes/FakeSyncStorage.ts`) é falso-positivo (palavra `download` em método).
- **Veredito**: dados de scratch/migração one-off. Não é código. Enterro seguro.

### 3. Sistema de campos `*.v2` órfão (mobile)
- `mobile/www/js/auth-manager-v2.js` — **zero imports**. Todo HTML carrega `js/auth-manager.js` (base). Órfão total.
- `mobile/www/js/fields/FieldFactory.v2.js` — importado **apenas** por `test-fields-v2.html` (página de teste). Nenhum HTML de produção o carrega; produção usa o `FieldFactory.js` base.
- `mobile/www/test-fields-v2.html` — harness de teste do v2.
- **Field types `*.v2.js` alcançáveis só via `FieldFactory.v2.js`/`test-fields-v2.html`**: `CameraField.v2`, `DateField.v2`, `GPSField.v2`, `SelectField.v2`, `ChipsField.v2`, `GalleryField.v2`, `NumberInputField.v2`, `RadioField.v2`, `TextInputField.v2`, `TextareaField.v2`, `TimeField.v2`.
  - ⚠️ **EXCEÇÃO — NÃO enterrar**: `CheckboxField.v2.js` é importado pelo `FieldFactory.js` **base** (linha 28) → está VIVO. Grepar cada `.v2` individualmente antes de remover.
- ℹ️ `smart-cache.v2.js` está **VIVO** (importado por `index.html`, `form-editor.html`, etc.) — não é morto, apesar do sufixo `.v2`.
- **Veredito**: enterrar `auth-manager-v2.js`, `FieldFactory.v2.js`, `test-fields-v2.html` e os field types `.v2` exclusivos do v2 (exceto `CheckboxField.v2`).

### 4. Diretórios `archive/` de CSS
- `mobile/styles/archive/` (519 KB) e `mobile/www/css/archive/` (232 KB).
- Conteúdo: `*.css.backup-YYYYMMDD-HHMMSS` (ex.: `design-system.css.backup-directives-20251003-130520`, `styles.css.backup-20251003-124904`).
- `mobile_standalone/styles/archive/` e `mobile_standalone/www/css/archive/` (vão junto com #1).
- **Veredito**: backups datados de CSS. Enterro seguro.

### 5. `download/indexeddb_leveldb/LOG.old`
- Arquivo `.old` dentro de dump LevelDB (subconjunto do #2).

### 6. Excludes mortos no `desktop/tsconfig.json`
- `exclude` aponta para `src/infrastructure/sync/_deprecated` e `src/application/ports/_deprecated` — **ambos não existem mais** no disco.
- O `CLAUDE.md` ainda documenta esses `_deprecated/` como existentes (Sync system / Key conventions) → doc desatualizada.
- **Veredito**: limpar as 2 linhas de `exclude` e atualizar `CLAUDE.md`. (config morta, inofensiva mas confusa)

### 7. `_analysis_output.json` (raiz, 12 KB)
- Arquivo de saída de análise solto na raiz. Nome de scratch. Nenhuma referência.

---

## MÉDIA confiança (revisar antes)

### 8. Páginas demo/teste embarcadas no `mobile/www/` (entram no APK)
`webDir` do Capacitor é `mobile/www/`, então estas são empacotadas no app:
- `field-gallery.html`, `occupation-selector-demo.html`, `presence-fields-demo.html`, `sync-demo.html`, `diagnose-users.html`.
- Provavelmente dev-only. Confirmar que nenhum link de produção aponta para elas antes de remover.

### 9. Rotas desktop de manutenção
- `desktop/app/admin/legacy/page.tsx` (24 KB) — **AINDA LINKADO** via `<Link href="/admin/legacy">` em `app/admin/page.tsx` (linha 89). Nome diz "legacy" mas é rota alcançável → **não é morto**; decidir se aposenta o link.
- `desktop/app/debug/page.tsx` — painel de debug/seed (`useDebugHealth`, `useSeedDemo`). Dev-only; manter ou esconder atrás de flag.

### 10. HTML soltos na raiz do repo
- `force-offline.html`, `install-success.html` — verificar se `server.js` da raiz os serve antes de remover.
- `local_db_schema.json`, `ecoponto-config.json` — possíveis artefatos de scratch; revisar.

---

## Resumo de espaço recuperável (ALTA confiança)

| Item | Tamanho aprox. |
|------|----------------|
| `mobile_standalone/` | 7,7 MB |
| `download/` | 12 MB |
| `mobile/styles/archive/` + `mobile/www/css/archive/` | ~750 KB |
| Cluster `*.v2` órfão (mobile) | ~poucos KB |
| **Total** | **~20 MB** |

## Notas
- Domínios `client/`/`crm/` e UI de ouvidoria **já foram removidos** corretamente do código ativo (sem resíduo em `app/` ou `domain/`); os refs restantes em `container.ts`/`SqliteClienteRepository.ts` são do domínio consolidado `cliente/` (PT-BR) — **não são mortos**.
- Repo não está sob git aqui — recomenda-se versionar antes de qualquer enterro.
