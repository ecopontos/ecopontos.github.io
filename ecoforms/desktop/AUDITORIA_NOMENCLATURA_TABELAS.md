# Auditoria de nomenclatura SQL — tabelas lusófonas

Data: 2026-06-29

## Objetivo

Verificar se as tabelas criadas no desktop seguem a convenção definida de nomenclatura lusófona e se o mesmo nome canônico está sendo usado no CRUD, queries e sync.

Escopo pesquisado:

- `scripts/ensure-columns.ts`
- `src/infrastructure/persistence/sqlite`
- `src/application/persistence/sqlite/queries`
- `src/infrastructure/sync`
- `src-tauri/src`
- `migrations`

## Resumo executivo

A convenção está parcialmente aplicada.

Áreas como formulários, módulos, decisões, usuários, tarefas, logística, ouvidoria e `TipoResiduo` já usam tabelas em português na maior parte do CRUD e do sync.

Ainda há desvios relevantes:

- Tabelas novas do Service Booking usam `tbl_service_types`, `tbl_service_slots`, `tbl_agendamentos` e `tbl_agendamento_notificacoes`.
- Configurações usam `tbl_configuracoes_sistema` e `tbl_email_config`, misturando prefixo `tbl_` com nome parcialmente inglês.
- `sync_salt_history` continua em inglês e é usado por Rust.
- `tbl_suite` e `suite_fts` continuam como camada auxiliar em inglês, apesar de existir `pacotes`.
- `geo_layers` usa tabela em inglês para camadas geográficas.
- Algumas tabelas foram renomeadas para português, mas preservam colunas físicas em inglês.
- Scripts legados ainda referenciam nomes antigos como `form_registry`.

## Tabelas aderentes

Exemplos encontrados no schema e nas queries:

| Tabela | Evidência | Observação |
| --- | --- | --- |
| `tipos_residuo` | `scripts/ensure-columns.ts`, `SqliteTipoResiduoRepository.ts`, `sync_residuos.rs` | Aderente no schema, CRUD e sync Rust. |
| `tipos_prazo` | `scripts/ensure-columns.ts`, `SqliteTipoPrazoRepository.ts` | Aderente. |
| `registro_formularios` | `scripts/ensure-columns.ts`, `queries/forms.ts`, `SubmitToRegistryUseCase.ts` | Aderente no CRUD principal. |
| `registro_modulos` | `scripts/ensure-columns.ts`, `queries/modules.ts`, `ModuleSyncHandler.ts` | Tabela lusófona, mas ainda há colunas inglesas. |
| `registro_visualizacoes` | `scripts/ensure-columns.ts`, `SqliteViewRegistryRepository.ts` | Tabela lusófona, com algumas colunas inglesas. |
| `registro_decisoes` | `scripts/ensure-columns.ts`, `SqliteDecisionRegistryRepository.ts` | Aderente em tabela e parte das colunas. |
| `visuais_modulos` | `scripts/ensure-columns.ts`, `ModuleSyncHandler.ts` | Tabela lusófona, colunas ainda mistas. |
| `instancias_widgets_usuario` | `scripts/ensure-columns.ts`, `SqliteUserWidgetInstanceRepository.ts`, `HandlerRegistry.ts` | Tabela lusófona, colunas ainda mistas. |
| `fila_eventos_sync`, `fila_eventos_lan`, `log_eventos_aplicados`, `log_gaps_sync`, `cursor_sync`, `manifesto_sync`, `log_dispositivos_sync` | `scripts/ensure-columns.ts`, sync/Rust/tests | Tabelas lusófonas com sufixo técnico `sync`. |
| `usuarios`, `clientes`, `manifestacoes`, `tarefas`, `projetos`, `roteiros`, `execucao_coleta`, `ecopontos` | Repositórios SQLite e bootstrap | Aderentes no nome da tabela. |

## Desvios de tabela

### Alta prioridade

| Tabela atual | Problema | Uso encontrado | Sugestão canônica |
| --- | --- | --- | --- |
| `tbl_service_types` | Nome em inglês + prefixo `tbl_` | `ensure-columns.ts`, `SqliteServiceTypeRepository.ts`, `queries/service.ts`, `LanPullService.ts` | `tipos_servico` |
| `tbl_service_slots` | Nome em inglês + prefixo `tbl_` | `ensure-columns.ts`, `SqliteServiceSlotRepository.ts`, `SqliteAgendamentoRepository.ts`, `queries/service.ts` | `slots_agendamento` ou `janelas_agendamento` |
| `tbl_agendamentos` | Prefixo `tbl_`; restante em português | `ensure-columns.ts`, `SqliteAgendamentoRepository.ts`, `queries/service.ts`, `HandlerRegistry.ts`, Rust LGPD | `agendamentos` |
| `tbl_agendamento_notificacoes` | Prefixo `tbl_` | `ensure-columns.ts`, `SqliteAgendamentoNotificacaoRepository.ts`, `queries/service.ts` | `notificacoes_agendamento` |
| `sync_salt_history` | Nome inteiro em inglês | `ensure-columns.ts`, `key_rotation.rs`, migration `011_add_key_escrow.sql` | `historico_sais_sync` ou `historico_sal_sync` |

### Média prioridade

| Tabela atual | Problema | Uso encontrado | Sugestão canônica |
| --- | --- | --- | --- |
| `tbl_configuracoes_sistema` | Prefixo `tbl_`; nome parcialmente ok | `ensure-columns.ts`, `LanFileStorage.ts`, `lan_paths.rs`, `lan_server`, `legacy_sync.rs`, `setup.rs` | `configuracoes_sistema` |
| `tbl_email_config` | Prefixo `tbl_` + `config` em inglês | `ensure-columns.ts`, `SqliteEmailConfigRepository.ts`, `email.rs` | `configuracao_email` |
| `tbl_lan_sync_cursors` | Tabela usada mas não criada no trecho principal do bootstrap encontrado | `LanPullService.ts`, teste `lan-pull-service.test.ts` | `cursores_sync_lan` |
| `tbl_suite` | Tabela auxiliar em inglês apesar de `pacotes` existir | `ensure-columns.ts` | revisar necessidade; se mantida, `pacotes_aux` ou migrar para `pacotes` |
| `suite_fts` | Nome em inglês | `ensure-columns.ts`, `queries/inbox.ts`, `lookups.ts` | `pacotes_fts` |
| `geo_layers` | Nome em inglês | `ensure-columns.ts`, `queries/geo_layers.ts`, `useMapData.ts` | `camadas_geo` |
| `app_config` | Nome em inglês e não apareceu no bootstrap principal pesquisado | `queries/system.ts`, comentário em `useNetworkParquet.ts` | `configuracoes_app` ou unificar em `configuracoes_sistema` |

## Desvios de colunas

Mesmo quando a tabela foi renomeada para português, há várias colunas físicas em inglês.

### Módulos

`registro_modulos` usa `icon`, `color`, `prefix`, `status`, `config_version`, `config_suite`.

`permissoes_modulos` usa `module_id`, `profile`, `can_view`, `can_create`, `can_edit`, `can_approve`, `can_delete`.

`visuais_modulos` usa `module_id`, `visual_type`, `name`, `config`, `is_default`, `user_id`, `parent_view_id`, `sync_status`, `position`.

O teste `sync-protocol.test.ts` deixa explícito que algumas colunas inglesas foram preservadas como canônicas físicas, por exemplo:

- não renomear `profile` para `perfil`
- não renomear `can_view` para `pode_visualizar`
- não renomear `visual_type` para `tipo_visual`
- não renomear `name` para `nome`

Isso é uma exceção deliberada no código atual, mas conflita com a regra ampla de schema lusófono.

### Widgets

`instancias_widgets_usuario` usa `dashboard_id`, `widget_type`, `data_source`, `display_config`, `position_x`, `position_y`, `position_w`, `position_h`, `position_order`.

Além disso, há divergência interna:

- `HandlerRegistry.ts` usa colunas em português em alguns handlers: `tipo_widget`, `fonte_dados`, `config_exibicao`.
- `SqliteUserWidgetInstanceRepository.ts` ainda usa colunas em inglês: `widget_type`, `data_source`, `display_config`.

Essa área precisa de validação contra o schema real antes de qualquer rename.

### Service Booking

As tabelas `tbl_service_types`, `tbl_service_slots` e `tbl_agendamentos` misturam português e inglês nas colunas:

- `form_id`
- `validator_key`
- `service_type_id`
- `slot_id`
- `task_id`
- `cliente_id`
- `setor_id`

O domínio do módulo é português na UI e nos use cases, mas a persistência manteve termos do ADR original em inglês.

### Sync/Rust

`sync_salt_history` usa:

- `user_id`
- `salt_encrypted`
- `salt_hash`
- `replaced_at`
- `replaced_by`
- `reason`

Como a tabela é usada em Rust (`key_rotation.rs`), a migração precisa coordenar TS + Rust.

## Scripts e migrações legadas

`scripts/migrate-ptbr.ts` registra várias renomeações de inglês para português. Isso é positivo como trilha de migração, mas também mostra nomes antigos que ainda aparecem em artefatos legados.

Ponto específico:

- `scripts/force_push_registry.js` ainda consulta `form_registry` e publica `shared/form_registry.json`.

Esse script parece legado/ad hoc, mas se ainda for usado operacionalmente ele está fora da convenção atual (`registro_formularios`).

Migrações antigas ainda criam nomes ingleses:

- `migrations/019_user_widget_instances.sql`
- `migrations/011_add_key_escrow.sql`
- `migrations/007_add_sync_device_log.sql`
- `migrations/012_idRota_uuid.sql` cria `tblRotas_new`

Se essas migrations ainda rodam em ambientes novos, elas precisam ser substituídas por bootstrap canônico ou migrações de compatibilidade.

## PocketBase POC

O POC criado para PocketBase usa a coleção padrão `tipos_residuo`, alinhada com a tabela SQLite lusófona.

Arquivo:

- `src/infrastructure/pocketbase/PocketBaseConfig.ts`

Isso está consistente com a convenção para o escopo do POC.

## Risco para sync e CRUD

Não é seguro renomear tabelas diretamente sem camada de compatibilidade porque há referências em:

- repositórios SQLite
- query packs em `src/application/persistence/sqlite/queries`
- handlers de sync em `HandlerRegistry.ts`
- `LanPullService.ts`
- comandos Rust (`email.rs`, `key_rotation.rs`, `legacy_sync.rs`, `lan_server`, `setup.rs`)
- testes que codificam nomes físicos atuais

O maior risco está no Service Booking e nas configurações, porque os nomes `tbl_*` aparecem em TS e Rust.

## Recomendação

1. Criar ADR curto ou complemento do ADR existente definindo a regra formal:
   - tabelas físicas em português;
   - colunas físicas em português;
   - exceções permitidas apenas para termos técnicos (`sync`, `fts`, talvez `id`);
   - nomes de arquivos/API podem continuar em inglês quando forem interface externa.

2. Corrigir por módulos, não globalmente:
   - Fase A: Service Booking (`tbl_service_types`, `tbl_service_slots`, `tbl_agendamentos`, `tbl_agendamento_notificacoes`).
   - Fase B: Configurações (`tbl_configuracoes_sistema`, `tbl_email_config`, `app_config`).
   - Fase C: Sync security (`sync_salt_history`).
   - Fase D: Suite auxiliar (`tbl_suite`, `suite_fts`).
   - Fase E: Geo (`geo_layers`).

3. Para cada fase:
   - adicionar `ALTER TABLE ... RENAME TO ...`;
   - criar fallback idempotente para bancos antigos;
   - atualizar CRUD/query packs;
   - atualizar sync handlers;
   - atualizar Rust;
   - atualizar testes;
   - rodar `npx tsc --noEmit`, `npm run lint`, testes focados e, quando Rust mudar, `cargo test`.

4. Evitar aliases permanentes via view para escrita. Views podem ajudar leitura temporária, mas escrita/sync deve convergir para uma única tabela física canônica.

## Conclusão

A convenção lusófona não está completa. Ela está bem aplicada em `tipos_residuo`, formulários, módulos no nome das tabelas, ouvidoria, tarefas e logística principal, mas há blocos importantes ainda em inglês ou mistos.

Para o debate PocketBase/offline-first, a decisão importante é: as coleções/tabelas do hub devem seguir os nomes canônicos em português do SQLite, por exemplo `tipos_residuo`, e não reintroduzir nomes ingleses como `waste_types` ou `service_types`.
