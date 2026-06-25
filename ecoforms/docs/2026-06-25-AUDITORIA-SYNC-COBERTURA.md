# Auditoria de Cobertura do Sistema de Sincronizacao

**Data:** 2026-06-25
**Escopo:** Desktop (Tauri v2 + Next.js) — pipeline EventSyncAdapter
**Objetivo:** Mapear todos os dados que o app produz vs o que o pipeline de sync consegue transportar, identificando gaps para planejamento de conexao entre instancias.

---

## 1. Resumo Executivo

A infraestrutura de sync (TransportService, InboundService, CryptoLayer, SyncOutbox, HandlerRegistry, fila SQLite) esta **implementada e funcional**. O pipeline e capaz de transportar qualquer tipo de dado, incluindo dados geoespaciais.

O problema nao e de infraestrutura, e sim de **cobertura**: muitas mutacoes do app nao publicam eventos de sync, e varios handlers inbound estao ausentes. Alem disso, existem mismatches de nomenclatura entre eventos publicados e handlers registrados.

**Numeros:**
- 69+ tabelas no schema SQLite
- 45 tipos de evento definidos em `EventEnvelope.ts`
- ~25 tabelas com mutacoes que **nao** emitem eventos de sync
- 3 mismatches criticos de nomenclatura
- 6 tipos de evento publicados sem handler inbound correspondente

---

## 2. Arquitetura do Pipeline (referencia)

```
Use Case / Repository
    |
    v
SyncOutbox.write(type, data)
    |
    v
TransportService.publish()  -->  fila_eventos_sync (SQLite, status=pending)
    |
    v
TransportService.pushPending()  -->  Supabase sync_event_index (AES-256-GCM)
    |
    v
[Outra instancia]
    |
    v
InboundService.pull(knownRoutingIds)  -->  baixa eventos remotos
    |
    v
HandlerRegistry  -->  aplica no SQLite local (INSERT/UPDATE)
```

**Canais:**
- **Primario:** Supabase Storage + RPCs (cloud, criptografado)
- **Secundario:** LAN WebSocket (P2P, sem internet)

---

## 3. Dominios com Sync Implementado

### 3.1 Tarefas (Tasks)

| Operacao | Evento Outbound | Handler Inbound | Status |
|----------|----------------|-----------------|--------|
| Criar | `task.criada` | `task.criada` | OK |
| Concluir | `task.concluida` | `task.concluida` | OK |
| Mover status | `task.movida` | `task.atualizada` | OK (handler generico) |
| Arquivar | `task.arquivada` | — | **Falta handler** |

**Arquivos:**
- Emissao: `application/task/CompleteTaskUseCase.ts`, `MoveTaskUseCase.ts`, `ArchiveTaskUseCase.ts`, `TaskProjectionService.ts`
- Handler: `infrastructure/sync/HandlerRegistry.ts` (linhas 154-194)

### 3.2 Demandas

| Operacao | Evento Outbound | Handler Inbound | Status |
|----------|----------------|-----------------|--------|
| Aceitar | `demanda.aceita` | `demanda.aceita` | OK |
| Encerrar | `demanda.encerrada` | — | **Falta handler** |
| Encaminhar | `demanda.encaminhada` | — | **Falta handler** |

**Arquivos:**
- Emissao: `application/demanda/AcceptDemandaUseCase.ts`, `CloseDemandaUseCase.ts`
- Handler: `HandlerRegistry.ts` (linhas 196-204)

### 3.3 Usuarios

| Operacao | Evento Outbound | Handler Inbound | Status |
|----------|----------------|-----------------|--------|
| Criar | `usuario.criado` | `usuario.criado` | OK |
| Atualizar | `usuario.atualizado` | `usuario.atualizado` | OK |
| Deletar | — | — | Sem evento |

**Status:** Funcional. Sync bidirecional parcial (Supabase -> SQLite via `SupabaseUserSyncService`; SQLite -> Supabase via eventos).

### 3.4 Modulos

| Operacao | Evento Outbound | Handler Inbound | Status |
|----------|----------------|-----------------|--------|
| Publicar | `module.publicado` | Via `ModuleSyncHandler` | OK |
| Arquivar | `module.arquivado` | Via `ModuleSyncHandler` | OK |
| Permissoes | — | — | **Sem sync** |

### 3.5 Visuais de Modulos

| Operacao | Evento Outbound | Handler Inbound | Status |
|----------|----------------|-----------------|--------|
| Criar | `visuais_modulos.created` | `visuais_modulos.created` | OK |
| Atualizar | `visuais_modulos.updated` | `visuais_modulos.updated` | OK |
| Deletar | `visuais_modulos.deleted` | `visuais_modulos.deleted` | OK |
| Set default | — | — | **Sem sync** |

### 3.6 Widgets de Dashboard

| Operacao | Evento Outbound | Handler Inbound | Status |
|----------|----------------|-----------------|--------|
| Criar | `instancias_widgets_usuario.created` | Handler registrado | OK |
| Atualizar | `instancias_widgets_usuario.updated` | Handler registrado | OK |
| Deletar | `instancias_widgets_usuario.deleted` | Handler registrado | OK |
| Reposicionar | — | — | **Sem sync** |

### 3.7 Ouvidoria (Manifestacoes)

| Operacao | Evento Outbound | Handler Inbound | Status |
|----------|----------------|-----------------|--------|
| Criar manifestacao | — | `manifestacao.criada` | **Falta emissao** |
| Atualizar status | `manifestacao.status_atualizado` | `manifestacao.status_atualizado` | OK |
| Tramitacao | — | `tramitacao.registrada` | **Falta emissao** |
| Resposta | — | `resposta.registrada` | **Falta emissao** |
| Despacho | — | `despacho.registrado` | **Falta emissao** |
| Prazo | — | `prazo.adicionado` | **Falta emissao** |

**Nota:** Handlers inbound sao ricos (6 tipos), mas a emissao outbound e parcial — apenas `UpdateManifestacaoStatusUseCase` publica evento.

### 3.8 Auditoria e Turnos

| Operacao | Evento | Status |
|----------|--------|--------|
| Log de auditoria | `audit.registro` | OK |
| Log de turno | `acesso.turno.log` | OK |

---

## 4. Dominios com Mismatches de Nomenclatura

Estes dominios tem infraestrutura parcial, mas os nomes dos eventos nao coincidem entre outbound e inbound:

### 4.1 Logistica — Roteiros

| Lado | Nome do Evento |
|------|---------------|
| **Outbound** (actions/builtin) | `crm.roteiro.criado`, `crm.roteiro.atualizado` |
| **Inbound** (HandlerRegistry) | `roteiro.criado`, `roteiro.atualizado` |

**Problema:** O outbound publica com prefixo `crm.`, o handler escuta sem prefixo. Eventos publicados nunca serao consumidos.

### 4.2 Agendamentos

| Lado | Nome do Evento |
|------|---------------|
| **Outbound** (AgendamentoEfeitosService) | `service.agendamento.criado`, `service.agendamento.confirmado`, etc. |
| **Inbound** (HandlerRegistry) | Nenhum handler registrado para `service.agendamento.*` |
| **EventEnvelope.ts** | `agendamento.criado`, `agendamento.confirmado` (sem prefixo `service.`) |

**Problema:** Triplo mismatch — o use case usa `service.agendamento.*`, o enum usa `agendamento.*`, e nenhum handler existe.

### 4.3 Logistica — Execucoes e Intercorrencias

| Lado | Nome do Evento |
|------|---------------|
| **Outbound** | Nenhum use case emite eventos de execucao |
| **Inbound** (HandlerRegistry) | `execucao.criada`, `execucao.status_atualizado`, `intercorrencia.registrada`, `intercorrencia.resolvida` |
| **EventEnvelope.ts** | Nenhum tipo `execucao.*` ou `intercorrencia.*` no enum |

**Problema:** Handlers existem e funcionariam, mas: (a) nenhum use case emite esses eventos, e (b) os tipos nao estao no enum de tipos validos.

---

## 5. Dominios SEM Qualquer Sync (Gaps Criticos)

### 5.1 Projetos Kanban

| Tabela | Mutacoes no Repository | Evento Necessario |
|--------|----------------------|-------------------|
| `projetos` | `createProject()`, `updateProject()` | `projeto.criado`, `projeto.atualizado`, `projeto.arquivado` |
| `projetos_interessados` | INSERT/DELETE em `createProject()` | `projeto.interessado.adicionado/removido` |

**Impacto:** Projetos criados numa instancia nao aparecem em outra.
**Repositorio:** `SqliteKanbanRepository`

### 5.2 Comentarios e Anexos de Tarefas

| Tabela | Mutacoes | Evento Necessario |
|--------|----------|-------------------|
| `tarefas_comentarios` | `addCommentToTask()` | `task.comentario.criado` |
| `tarefas_anexos` | Via use case de anexos | `task.anexo.criado` |
| `tarefa_formularios` | `linkFormulario()` | `task.formulario.vinculado` |

**Impacto:** Colaboracao em tarefas nao sincroniza.
**Repositorio:** `SqliteKanbanRepository`

### 5.3 Terrenos (Geoprocessamento)

| Tabela | Mutacoes | Evento Necessario |
|--------|----------|-------------------|
| `terrenos` | INSERT, UPDATE, DELETE via `useMapData.ts` | `terreno.criado`, `terreno.atualizado`, `terreno.deletado` |
| `terrenos_rtree` | INSERT/REPLACE (indice espacial derivado) | Nenhum — reconstruido pelo handler |

**Impacto:** Terrenos cadastrados numa instancia nao aparecem no mapa de outra.
**Nota tecnica:** Poligonos GeoJSON podem ser grandes (centenas de coordenadas). O campo `data` do envelope comporta isso, mas vale considerar compressao para importacoes em massa.

### 5.4 Camadas GeoJSON (geo_layers)

| Tabela | Mutacoes | Evento Necessario |
|--------|----------|-------------------|
| `geo_layers` | INSERT, UPDATE, DELETE via `useMapData.ts` | `geo_layer.criado`, `geo_layer.atualizado`, `geo_layer.deletado` |

**Impacto:** Camadas importadas por upload nao propagam.
**Nota tecnica:** Um arquivo GeoJSON pode ter megabytes. Estrategia recomendada: subir o arquivo para Supabase Storage e emitir evento com `storage_path` como referencia. O handler inbound faz download do blob.

### 5.5 Ecopontos

| Tabela | Mutacoes | Evento Necessario |
|--------|----------|-------------------|
| `ecopontos` | INSERT, UPDATE via `SqliteEcopontoRepository` | `ecoponto.criado`, `ecoponto.atualizado` |

### 5.6 Clientes (Detalhes)

| Tabela | Mutacoes | Evento Necessario |
|--------|----------|-------------------|
| `clientes` | `save()` | `crm.cliente.criado/atualizado` — **ja tem evento** |
| `cliente_contatos` | `saveContato()` | `cliente_contato.criado`, `.atualizado`, `.deletado` |
| `cliente_pj_vinculo` | `createVinculoPJ()`, `deleteVinculoPJ()` | `cliente_vinculo.criado`, `.deletado` |

**Impacto:** O cliente principal sincroniza, mas contatos e vinculos PJ nao.

### 5.7 Roteiro-Clientes (Composicao de Roteiros)

| Tabela | Mutacoes | Evento Necessario |
|--------|----------|-------------------|
| `roteiro_clientes` | `addClienteToRoteiro()`, `removeClienteFromRoteiro()`, `updateClienteOrdem()` | `roteiro_cliente.adicionado`, `.removido`, `.reordenado` |

**Impacto:** A composicao de roteiros (quais clientes, em que ordem) nao propaga.

### 5.8 Execucao — Detalhes

| Tabela | Mutacoes | Evento Necessario |
|--------|----------|-------------------|
| `execucao_clientes` | `saveExecucaoCliente()` | `execucao_cliente.registrado` |
| `execucao_pesagens` | INSERT direto | `pesagem.registrada` |
| `checklist_execucao` | `saveChecklistItem()` | `checklist.item.atualizado` |

### 5.9 Registros de Decisoes e Visualizacoes

| Tabela | Mutacoes | Evento Necessario |
|--------|----------|-------------------|
| `registro_decisoes` | CRUD via `SqliteDecisionRegistryRepository` | `decisao.criada`, `.atualizada`, `.deletada` |
| `registro_visualizacoes` | CRUD via `SqliteViewRegistryRepository` | `view.criada`, `.atualizada`, `.deletada` |

### 5.10 Suites (Parcial)

| Evento Publicado | Handler Inbound | Status |
|-----------------|-----------------|--------|
| `suite.editado` | — | **Sem handler** |
| `suite.aprovado` | — | **Sem handler** |
| `suite.rejeitada` | — | **Sem handler** |
| `suite.solicitada` | — | **Sem handler** |
| `suite.devolvida` | — | **Sem handler** |
| `suite.reencaminhada` | — | **Sem handler** |

**Impacto:** Fluxo de aprovacao de suites nao propaga entre instancias.

---

## 6. Dados de Mapa — Consideracoes Especificas

Os dados geoespaciais apresentam desafios especificos para o pipeline de sync:

### 6.1 Terrenos (Poligonos)

- **Tamanho:** Um poligono pode ter centenas de coordenadas (pares lat/lng). Serializado como JSON, um terreno complexo pode ocupar 5-50KB.
- **Volume:** Importacao em massa de terrenos pode gerar dezenas de eventos simultaneos.
- **Estrategia:** O envelope suporta payloads arbitrarios via campo `data: unknown`. Para importacoes em massa, considerar:
  - Agrupar em batches menores (10-20 terrenos por evento)
  - Ou usar evento de referencia: `{storage_path: "orgs/.../terrenos_batch_001.json"}`
- **R-Tree:** O indice `terrenos_rtree` e derivado — o handler inbound deve recalcular `INSERT INTO terrenos_rtree (id, minX, maxX, minY, maxY)` a partir das coordenadas do terreno recebido.

### 6.2 Camadas GeoJSON (geo_layers)

- **Tamanho:** Arquivos GeoJSON podem ter megabytes (10MB+).
- **Estrategia recomendada:** Nao embutir no envelope. Usar abordagem hibrida:
  1. Upload do GeoJSON para Supabase Storage: `orgs/{orgId}/geo_layers/{layerId}.geojson`
  2. Emitir evento `geo_layer.criado` com `{id, nome, storage_path, metadata}`
  3. Handler inbound faz download do blob e insere no SQLite local
- **Vantagem:** Reutiliza o `SupabaseFileStorage` ja existente. Mesma abordagem que `ecoforms.anexo.criado`.

### 6.3 Clientes com Coordenadas

- **Tamanho:** Pequeno (~200 bytes por cliente com lat/lng).
- **Estrategia:** Evento normal, sem tratamento especial.

### 6.4 Itinerarios

- **Natureza:** Derivados de `roteiro_clientes` + coordenadas dos clientes. Nao precisam de sync direto — sao recalculados localmente a partir dos dados sincronizados.

---

## 7. Problema Estrutural: Discovery de Routing IDs

O `InboundService.pull()` so executa se `knownRoutingIds` estiver populado:

```typescript
// EventSyncAdapter.ts, linha 47
if (this.knownRoutingIds.length > 0) {
    const pullResult = await this.inbound.pull(this.knownRoutingIds);
}
```

Atualmente, `setKnownRoutingIds()` **nunca e chamado automaticamente**. Sem isso, nenhuma instancia puxa eventos de outra.

**Solucao proposta:**
1. Criar tabela/RPC no Supabase: `sync_devices(org_id, routing_id, device_id, last_seen_at)`
2. Cada instancia registra-se no boot: `INSERT INTO sync_devices ...`
3. No `SyncContext`, antes do `syncAll()`, buscar routing IDs da org: `SELECT routing_id FROM sync_devices WHERE org_id = ?`
4. Chamar `syncAdapter.setKnownRoutingIds(ids)` com os resultados

---

## 8. Plano de Acao Proposto

### Fase 1 — Corrigir Inconsistencias (esforco: 1-2 dias)

1. Normalizar nomes de eventos:
   - `crm.roteiro.*` -> `roteiro.*` (ou atualizar handlers)
   - `service.agendamento.*` -> `agendamento.*` (ou registrar handlers)
2. Adicionar tipos faltantes ao enum `EcoFormsEventTypes`:
   - `execucao.criada`, `execucao.status_atualizado`
   - `intercorrencia.registrada`, `intercorrencia.resolvida`
   - `task.arquivada`, `task.atualizada`
3. Adicionar handlers inbound faltantes:
   - `task.arquivada`, `demanda.encerrada`, `demanda.encaminhada`
   - Suite handlers (6 tipos)

### Fase 2 — Sync de Dados Estruturados (esforco: 5-7 dias)

Por prioridade de impacto:

1. **Projetos Kanban** — `projeto.criado/atualizado/arquivado`
2. **Comentarios/Anexos** — `task.comentario.criado`, `task.anexo.criado`
3. **Ouvidoria (emissao)** — adicionar `SyncOutbox.write()` nos repositories/use cases
4. **Clientes (detalhes)** — `cliente_contato.*`, `cliente_vinculo.*`
5. **Logistica (detalhes)** — `roteiro_cliente.*`, `execucao_cliente.*`, `checklist.*`

### Fase 3 — Sync de Dados Geoespaciais (esforco: 3-4 dias)

1. **Terrenos** — eventos com payload GeoJSON direto no envelope
2. **Geo_layers** — abordagem hibrida (Storage + evento de referencia)
3. **Ecopontos** — eventos padrao
4. **R-Tree rebuild** — logica no handler inbound

### Fase 4 — Discovery e Integracao (esforco: 2-3 dias)

1. Criar RPC/tabela `sync_devices` no Supabase
2. Auto-registro no boot
3. Auto-discovery no `SyncContext` antes de cada `syncAll()`
4. Teste end-to-end com 2+ instancias

---

## 9. Matriz de Risco

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Payloads GeoJSON grandes causam timeout no push | Media | Alto | Chunking + compressao; limite de batch |
| Conflito de edicao simultanea em terrenos | Baixa | Medio | LWW (Last Write Wins) ja implementado no ConflictResolver |
| Sequencia de eventos fora de ordem | Baixa | Alto | InboundService ja detecta gaps e faz retry |
| Chave cripto diferente entre instancias | Media | Critico | Todas as instancias devem derivar chave do mesmo password+salt |
| geo_layers duplicados por re-sync | Media | Baixo | Dedup via `log_eventos_aplicados` ja implementado |

---

## 10. Referencias

- `infrastructure/sync/EventEnvelope.ts` — tipos de evento definidos
- `infrastructure/sync/HandlerRegistry.ts` — handlers inbound (439 linhas)
- `infrastructure/sync/TransportService.ts` — push para Supabase
- `infrastructure/sync/InboundService.ts` — pull de eventos remotos
- `infrastructure/sync/SyncOutbox.ts` — fachada de publicacao
- `infrastructure/sync/EventSyncAdapter.ts` — orquestrador principal
- `infrastructure/sync/lazy-sync.ts` — inicializacao lazy + factory
- `contexts/SyncContext.tsx` — integracao React + auto-sync
- `scripts/ensure-columns.ts` — schema SQLite (fonte de verdade)
