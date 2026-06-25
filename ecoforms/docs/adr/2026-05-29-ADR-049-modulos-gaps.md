# ADR-049 — Módulos: Gaps de Implementação

**Data:** 2026-05-29  
**Status:**Implementado**
**Módulo analisado:** `app/modulo/[slug]` + `app/admin/modules/*`

---

## Contexto

Análise estática completa do módulo Módulos (Module Registry) cobrindo: domínio, casos de uso, infraestrutura (SQLite), sincronização, componentes UI e rotas. O objetivo é mapear o que está implementado, o que está incompleto e o que é crítico para operação em produção.

---

## O que está implementado

| Camada | Artefato | Status |
|---|---|---|
| Domínio | `ModuleRegistry`, `ModuleConfig`, `ModulePermissionConfig`, `ModuleRuntimeDto` | ✅ Completo |
| Domínio | `ModuleRepository` (interface) | ✅ Completo |
| Domínio | `ModuleVisualView`, `ModuleVisualViewRepository` | ✅ Completo |
| Aplicação | `CreateModuleUseCase`, `PublishModuleUseCase`, `ListModulesUseCase` | ✅ Completo |
| Aplicação | `GetModuleRuntimeUseCase`, `UpdateModuleConfigUseCase` | ✅ Completo |
| Aplicação | `GetModuleVisuaisUseCase` (com cache) | ✅ Completo |
| Infraestrutura | `SqliteModuleRepository` (CRUD + permissões + loadRuntimeDto) | ✅ Completo |
| Infraestrutura | `SqliteModuleVisualViewRepository` (CRUD + setDefault) | ✅ Completo |
| Infraestrutura | `ModuleSyncHandler` (inbound: publicado, arquivado, visuais CRUD) | ✅ Parcial |
| UI Admin | `/admin/modules` — listagem com criar + publicar | ✅ Parcial |
| UI Admin | `/admin/modules/new` — wizard 6 passos | ✅ Completo |
| UI Admin | `/admin/modules/visuals` — configurador drag-and-drop | ✅ Parcial |
| UI Runtime | `/modulo/[slug]` — runtime page | ✅ Parcial |

---

## Gaps Identificados

### GAP-1 · CRÍTICO — Discrepância de nome de tabela sem migration formal

**Onde:** `migrations/010_add_module_registry.sql` vs `SqliteModuleRepository.ts`

Migration 010 cria `module_registry` e `module_permissions`. O repositório (e o sync handler) usam `registro_modulos` e `permissoes_modulos`. A reconciliação existe apenas em `scripts/migrate-ptbr.ts` (script manual de renomeação) e em `scripts/ensure-columns.ts` (DDL de fallback). **Não há migration numerada** que faça o `RENAME TABLE`.

Instâncias frescas do banco que rodem as migrations em ordem terão `module_registry`, mas o código tentará ler `registro_modulos` → todas as queries falham silenciosamente.

**Correção:** Criar migration `013_rename_module_registry.sql` com:
```sql
ALTER TABLE module_registry RENAME TO registro_modulos;
ALTER TABLE module_permissions RENAME TO permissoes_modulos;
```

---

### GAP-2 · CRÍTICO — Colunas de permissão: inglês no código, português no script de renomeação

**Onde:** `SqliteModuleRepository.ts` (linhas 134–152) vs `scripts/migrate-ptbr.ts`

O `migrate-ptbr.ts` pretendia renomear `profile → perfil`, `can_view → pode_visualizar`, etc. O repositório ainda usa os nomes ingleses. Se o script foi aplicado, o repositório está quebrado. Se não foi, está funcionando — mas há divergência de intenção não documentada.

**Correção:** Decidir e documentar: manter colunas em inglês (reverter intenção do script) ou completar a renomeação no repositório. Recomendado: manter inglês para consistência com o domínio.

---

### GAP-3 · ALTO — Sem página de edição de módulo (metadados)

**Onde:** `app/admin/modules/` — ausente `/admin/modules/[id]/edit`

Após criar um módulo, não é possível editar nome, descrição, icon, cor, prefix ou `ordem` pela UI. O botão "Ver" (Eye) na listagem leva para `/modulo/[slug]` (runtime), não para edição admin.

`UpdateModuleConfigUseCase` aceita apenas `config` e `permissions`, não os campos de metadados.

**Correção necessária:**
1. Adicionar `UpdateModuleMetadataInput` ao `UpdateModuleConfigUseCase` (ou criar use case separado)
2. Criar rota `/admin/modules/[id]/edit` com formulário de metadados
3. Adicionar botão "Editar" na listagem admin

---

### GAP-4 · ALTO — Sem `ArchiveModuleUseCase` e ação de arquivamento na UI

**Onde:** `src/application/module/` — faltando `ArchiveModuleUseCase.ts`

`ModuleSyncHandler` processa `module.arquivado` (inbound do servidor). `ModuleStatus` inclui `'archived'`. Mas não existe:
- `ArchiveModuleUseCase` na camada de aplicação
- Ação "Arquivar" na UI admin
- Ação "Excluir" na UI admin (apesar de `ModuleRepository.delete()` existir)

Módulos publicados só podem ser arquivados via evento de sync remoto, nunca localmente.

**Correção:**
```typescript
// ArchiveModuleUseCase.ts
export class ArchiveModuleUseCase {
  async execute(id: string): Promise<void> {
    const mod = await this.repo.findById(id);
    if (!mod) throw new Error(`Module not found: ${id}`);
    mod.status = 'archived';
    mod.atualizado_em = new Date().toISOString();
    await this.repo.save(mod);
  }
}
```
Adicionar botão "Arquivar" na listagem admin (apenas para status `published`).

---

### GAP-5 · ALTO — `ViewConfigDialog` descarta configuração silenciosamente

**Onde:** `components/module-visuals/ModuleVisualsConfig.tsx:225`

```tsx
// Código atual — onSave nunca aplica a config ao visual
<ViewConfigDialog
  onSave={() => setViewDialogOpen(false)}  // ← config editada é descartada
/>
```

O dialog aceita colunas e filtros, mas o callback `onSave` apenas fecha o dialog. A config editada nunca é aplicada de volta ao `VisualItem` nem persistida.

**Correção:**
```tsx
<ViewConfigDialog
  onSave={(config) => {
    setVisuals(prev => prev.map(v =>
      v.id === selectedVisual?.id ? { ...v, viewConfig: config } : v
    ));
    setViewDialogOpen(false);
  }}
/>
```
E incluir `viewConfig` no payload salvo via `handleSaveConfig`.

---

### GAP-6 · ALTO — Dois sistemas de visuais paralelos e incompatíveis

**Onde:** `ModuleVisualsConfig.tsx` vs `GetModuleVisuaisUseCase.ts`

`ModuleVisualsConfig` salva visuais em `mod.config.visuais` (campo JSON não tipado dentro de `configuracao`). `GetModuleVisuaisUseCase` lê visuais da tabela `visuais_modulos` (SQL). São fontes diferentes:

| Sistema | Onde salva | Quem lê |
|---|---|---|
| Admin Config UI | `registro_modulos.configuracao → visuais[]` | `ModuleVisualsConfig.loadModuleData()` |
| Runtime | `visuais_modulos` (tabela SQL) | `GetModuleVisuaisUseCase` |

Configurar visuais no admin não cria registros em `visuais_modulos`. A página runtime (`/modulo/[slug]`) nunca verá as configurações feitas no admin.

**Correção:** `ModuleVisualsConfig.handleSaveConfig` deve upsert em `visuais_modulos` via `SqliteModuleVisualViewRepository.save()`, não via `UpdateModuleConfigUseCase`. Remover o campo `config.visuais` do JSON.

---

### GAP-7 · MÉDIO — Rota de visuais é query-param, não segmento dinâmico

**Onde:** `app/admin/modules/visuals/page.tsx`

A rota atual é `/admin/modules/visuals?slug=X` (parâmetro de query). O padrão do projeto (e Next.js App Router) usa segmentos dinâmicos: `/admin/modules/[slug]/visuals`.

Isso quebra o botão "back" do browser e dificulta deep-linking.

**Correção:** Mover para `app/admin/modules/[slug]/visuals/page.tsx` e atualizar o link na listagem admin.

---

### GAP-8 · MÉDIO — `loadRuntimeDto` retorna `view.definition = null` hardcoded

**Onde:** `SqliteModuleRepository.ts:208–213`

```typescript
const views = (config.views || []).map(v => ({
  view_id: v.view_id,
  context: v.context,
  order: v.order,
  definition: null,  // ← sempre null, nunca carregado
}));
const decisions = (config.decisions || []).map(d => ({
  decision_id: d.decision_id,
  definition: null,  // ← sempre null
}));
```

A seção "Visualizações" e "Decisões" no runtime exibem apenas `view_id` como texto, sem nenhuma definição ou renderização real.

**Correção:** Implementar `ViewRegistryRepository.findById(view_id)` e `DecisionRegistryRepository.findById(decision_id)` para carregar as definições. Já existem `SqliteViewRegistryRepository` e `SqliteDecisionRegistryRepository` no container — usá-los aqui.

---

### GAP-9 · MÉDIO — Permissões exibidas como badge mas não aplicadas na UI

**Onde:** `app/modulo/[slug]/ModuloPageClient.tsx:86–91`

`can_create` bloqueia o botão "Novo Registro" corretamente. Mas `can_edit`, `can_approve` e `can_delete` só aparecem como badges informativos — nenhuma ação na página é condicionada a eles. Quando um registro é exibido, qualquer usuário pode tentar editá-lo ou excluí-lo via ações downstream.

**Correção:** Passar `moduleData.permissions` como contexto para os componentes filhos (FormRenderer, listas de registros) e ocultar/desabilitar ações conforme o perfil.

---

### GAP-10 · MÉDIO — Sem sincronização outbound de módulos

**Onde:** `ModuleSyncHandler.ts`

O handler registra apenas listeners **inbound** (`inbound.on(...)`). Criação e publicação locais de módulos não emitem eventos para o servidor de sync. Se outro cliente ou o servidor precisar ser notificado de um novo módulo criado localmente, o evento nunca chega.

**Correção:** Adicionar chamadas `outbound.emit('module.criado', ...)` e `outbound.emit('module.publicado', ...)` nos use cases `CreateModuleUseCase` e `PublishModuleUseCase`, ou via Domain Event pattern.

---

### GAP-11 · BAIXO — Sem filtro de status e busca na listagem admin

**Onde:** `app/admin/modules/page.tsx`

A listagem carrega todos os módulos sem filtro de status (`draft`/`published`/`archived`), sem busca por nome e sem paginação. Com muitos módulos o custo de renderização e legibilidade degradam.

**Correção:** Adicionar tabs por status + campo de busca por nome. `ListModulesUseCase` já aceita `status` como parâmetro.

---

### GAP-12 · BAIXO — `ensure-columns.ts` como DDL de bootstrap paralelo

**Onde:** `scripts/ensure-columns.ts`

Contém `CREATE TABLE IF NOT EXISTS registro_modulos` e `permissoes_modulos` com schema próprio (sem `versao` e com `can_view` inglês). Funciona como migration de fallback não versionada. Qualquer divergência de schema entre este script e as migrations formais é silenciosa.

**Recomendação:** Remover DDL de módulos do `ensure-columns.ts` e garantir que as migrations cubram todos os cenários (incluindo o rename do GAP-1).

---

## Prioridade de implementação

| # | Gap | Impacto | Esforço |
|---|---|---|---|
| 1 | GAP-1: rename migration formal | Produção quebra em fresh install | Baixo |
| 2 | GAP-6: dois sistemas de visuais | Admin não reflete no runtime | Médio |
| 3 | GAP-5: ViewConfigDialog não salva | Config silenciosamente descartada | Baixo |
| 4 | GAP-3: sem página de edição | Módulos imutáveis pós-criação | Médio |
| 5 | GAP-4: sem ArchiveModuleUseCase | Ciclo de vida incompleto | Baixo |
| 6 | GAP-8: definition=null hardcoded | Runtime views/decisions inúteis | Médio |
| 7 | GAP-9: permissões não aplicadas | Controle de acesso incompleto | Médio |
| 8 | GAP-2: colunas inglês/português | Risco latente se script foi aplicado | Baixo |
| 9 | GAP-7: rota query-param | DX e deep-linking ruins | Baixo |
| 10 | GAP-10: sem outbound sync | Multi-cliente incompleto | Alto esforço |
| 11 | GAP-11: sem filtro/busca | Ergonomia admin | Baixo |
| 12 | GAP-12: ensure-columns DDL | Risco de divergência | Baixo |
