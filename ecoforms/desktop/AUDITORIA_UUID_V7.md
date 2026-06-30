# Auditoria UUID v7

Data: 2026-06-29
Atualizacao: 2026-06-30

## Objetivo

Verificar se os IDs gerados no `ecoforms/desktop` usam UUID v7.

Escopo pesquisado:

- `app`
- `components`
- `src`
- `scripts`
- `src-tauri`
- `migrations`
- `packages/core/src/utils/uuidv7.ts`

## Conclusão

Após a correção de 2026-06-30, os geradores persistidos identificados nesta auditoria foram migrados para UUID v7, exceto exceções deliberadas/legadas listadas abaixo.

Há três categorias:

1. **Aderente:** geração via `uuidv7()`.
2. **Corrigido em 2026-06-30:** geração persistida que usava `Date.now()`, `Math.random()`, `rand::<u128>()` ou UUID v4.
3. **Exceção/baixo risco:** IDs semânticos de catálogo, IDs temporários de UI, tokens/sessões, nomes de arquivo ou diretórios temporários de teste.

## Helper canônico

O helper canônico está em:

- `ecoforms/packages/core/src/utils/uuidv7.ts`

Ele define bits de versão `7` e variante RFC, e há teste em:

- `ecoforms/desktop/src/utils/__tests__/uuidv7.test.ts`

Portanto, para TypeScript/React, o caminho correto é importar:

```ts
import { uuidv7 } from 'ecoforms-core';
```

## Áreas aderentes

Exemplos que usam `uuidv7()` corretamente:

- `CreateTaskUseCase`
- `SubmitSuiteUseCase`
- `CreateServiceTypeUseCase`
- `CreateServiceSlotUseCase`
- `CreateBookingUseCase`
- `CreateDemandaUseCase`
- `AcceptDemandaUseCase`
- `CloseDemandaUseCase`
- `TaskProjectionService`
- `SqliteProjectRepository`
- `SqliteKanbanRepository`
- `SqliteLogisticsRepository`
- `SqliteUserRepository`
- `EventEnvelope`
- `InboundService`
- `LanDomainSyncService`
- `SupabaseUserSyncService`
- telas/hooks de `manifestacoes`, `clientes`, `roteiros`, `execucoes`, `prazos`, `setores`, `escalas`

## Corrigido em 2026-06-30 — persistido

### 1. Anexos de tarefas

Arquivo:

- `components/kanban/TaskAttachments.tsx`

Problema original:

```ts
return `anexo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
```

Esse ID é gravado em `tarefas_anexos` via `insertTarefaAnexo`.

Correção aplicada/sugerida:

```ts
const attachmentId = uuidv7();
```

Aplicado em 2026-06-30.

### 2. Camadas geográficas

Arquivo:

- `components/logistics/hooks/useLayerActions.ts`

Problema original:

```ts
id: `layer-${Date.now()}`
```

Esse ID é persistido em `geo_layers`.

Correção aplicada/sugerida:

```ts
id: uuidv7()
```

Aplicado em 2026-06-30.

### 3. Importação de terrenos sem código cadastral

Arquivo:

- `components/logistics/TerrenoImport.tsx`

Problema original:

```ts
const id = codigo
    ? `terreno-${codigo.replace(/\W/g, '-')}`
    : `terreno-${Date.now()}-${idx}`;
```

Quando há `codigo`, o ID é determinístico/semântico. Quando não há, cai em timestamp.

Decisão aplicada em 2026-06-30:

- Código cadastral continua como chave semântica quando presente.
- Fallback sem código cadastral passou a usar `uuidv7()`.

### 4. Campos de formulário criados no editor

Arquivos:

- `components/forms/SchemaEditor.tsx`
- `components/forms/FieldPropertiesPanel.tsx`

Problema original:

```ts
const uid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
```

Esses IDs entram no JSON de schema (`registro_formularios.conteudo`). Não são IDs de tabela, mas são identificadores persistidos de campos.

Decisão necessária:

- Se a regra "todos os UUID" inclui campos de formulário, usar `uuidv7()`.
- Se IDs de campos devem continuar legíveis/estáveis (`field_x`), documentar como exceção de schema.

### 5. Rust: sync de resíduos

Arquivo:

- `src-tauri/src/commands/sync_residuos.rs`

Problema original:

```rust
let new_id = uuid::Uuid::new_v4().to_string();
```

Esse ID é persistido em `tipos_residuo`.

Correção aplicada/sugerida:

- Implementar helper UUID v7 em Rust, ou
- receber ID v7 da camada TS antes do insert.

### 6. Rust: sync de roteiros

Arquivo:

- `src-tauri/src/commands/sync_roteiros.rs`

Problema original:

```rust
let new_id = Uuid::new_v4().to_string();
```

Esse ID é persistido em `roteiros`.

Correção aplicada/sugerida: usar gerador v7 em Rust.

### 7. Rust: sync de pesagens

Arquivo:

- `src-tauri/src/commands/sync_pesagens.rs`

Problemas:

```rust
let new_id = Uuid::new_v4().to_string();
```

Encontrado para inserts em:

- `execucao_coleta`
- `execucao_pesagens`

Correção aplicada/sugerida: usar gerador v7 em Rust.

### 8. Rust: anexos via LAN server

Arquivo:

- `src-tauri/src/lan_server/file_routes.rs`

Problema original:

```rust
anexo_id = uuid::Uuid::new_v4().to_string();
```

Esse ID é usado quando o upload não informa `anexo_id`.

Correção aplicada/sugerida: gerar UUID v7 em Rust quando o ID vier vazio.

### 9. Rust: rotação de chave/salt

Arquivo:

- `src-tauri/src/commands/key_rotation.rs`

Problema original:

```rust
let escrow_id = format!("salt-{}", uuid::Uuid::new_v4());
```

Esse ID é persistido em `sync_salt_history`.

Decisão aplicada em 2026-06-30:

- O prefixo semântico `salt-` foi mantido.
- A parte variável passou a usar UUID v7: `salt-${uuid_v7_string()}`.

### 10. Rust: auditoria do LAN server

Arquivo:

- `src-tauri/src/lan_server/auth.rs`

Problema original:

```rust
let audit_id = uuid::Uuid::new_v4().simple().to_string();
```

Esse ID é persistido em `log_auditoria`.

Correção aplicada/sugerida: usar UUID v7 em Rust.

## Não aderente — scripts/migrações legadas

### `scripts/verify-sync-event-index.ts`

Usa:

```ts
randomUUID()
```

Parece script de verificação. Se gerar registros persistidos em ambiente real, trocar para `uuidv7()`.

### `migrations/009_add_client_uuid.sql`

Comentário explícito:

```sql
-- Replaces Date.now() timestamp with crypto.randomUUID() (v4)
```

É migração antiga para `pjuridicas.uuid`. Se ainda rodar ou se esses dados ainda forem relevantes, existe legado v4 no banco.

## Exceções/baixo risco

### IDs de sessão/dispositivo temporário

Arquivos:

- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/auth.rs`
- `src-tauri/src/lan_server/auth.rs`
- `src/infrastructure/config/device-config.ts`

Há IDs de sessão, tokens ou fallback SSR com `new_v4()`/`Date.now()`. Eles não são necessariamente identidade de entidade de domínio. Ainda assim, se a regra for literal ("qualquer identificador"), também devem migrar.

### Diretórios temporários de teste

Arquivos:

- `src-tauri/src/lan_paths.rs`
- `src-tauri/src/commands/lan_storage.rs`
- `src-tauri/src/commands/legacy_sync.rs`
- `src-tauri/src/lan_server/auth.rs`

Usam UUID v4 para criar paths temporários em testes. Baixo risco para dados de domínio.

### IDs de UI

Arquivo:

- `components/registry/DataRegistryList.tsx`

Usa `Math.random()` para IDs de filtros em estado de UI. Não é persistência de domínio.

## Dependência Rust

`src-tauri/Cargo.toml` está configurado com:

```toml
uuid = { version = "1", features = ["v4"] }
```

Foi implementado um helper local em Rust, equivalente ao `ecoforms-core`:

- `src-tauri/src/uuid_v7.rs`
- teste `uuid_v7::tests::generates_uuid_v7`

A dependência `uuid` com feature `v4` permanece para tokens/sessões/paths temporários ainda existentes.

## Recomendação

1. Helper único no Rust criado em 2026-06-30:
   - `fn uuid_v7_string() -> String`
   - teste cobre versão `7` e variante RFC.

2. IDs persistidos substituídos em 2026-06-30:
   - `TaskAttachments.tsx`
   - `useLayerActions.ts`
   - fallback de `TerrenoImport.tsx`
   - `sync_residuos.rs`
   - `sync_roteiros.rs`
   - `sync_pesagens.rs`
   - `file_routes.rs`
   - `key_rotation.rs`
   - `lan_server/auth.rs`

3. Decidir explicitamente as exceções:
   - IDs semânticos de catálogo (`setor-admin`, `form-agendamento-*`, `volumosos`, etc.).
   - IDs de campos de formulário.
   - tokens/sessões/dispositivos.
   - nomes de arquivo/path temporário.

4. Adicionar uma verificação automática simples:
   - `rg "randomUUID|new_v4|Math.random\\(|Date.now\\(\\).*id|layer-\\$\\{Date.now|anexo_\\$\\{Date.now"`.

## Estado atual

A afirmação precisa agora é:

- **IDs novos persistidos de domínio identificados nesta auditoria:** usam UUID v7 ou exceção semântica documentada.
- **UUID v4 remanescente:** restrito a tokens/sessões, device/server runtime id e paths temporários de teste.
- **Legado/migração:** ainda há registro explícito de v4 em `migrations/009_add_client_uuid.sql`.
- **IDs de campos de formulário:** continuam como identificadores semânticos/legíveis dentro de JSON de schema; decidir em ADR separado se também devem virar UUID v7 puro.
