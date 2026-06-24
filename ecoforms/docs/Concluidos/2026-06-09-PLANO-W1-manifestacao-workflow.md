# Plano W1 — ManifestacaoWorkflowConfig

**Data:** 2026-06-09
**Status:** Análise concluída — melhorias incrementais recomendadas

---

## Diagnóstico

O `ManifestacaoWorkflowConfig` **já está sendo usado** pela `ManifestacaoDetailPage`:

### O que já funciona ✅

| Componente | Uso |
|------------|-----|
| `useManifestacaoWorkflow` hook | Consome `MANIFESTACAO_WORKFLOW[status]` |
| `ManifestacaoWorkflowActions` | Renderiza botões dinâmicos por status |
| `sections.fluxo` | Controla visibilidade do card "Ações do Fluxo" |
| `sections.classificacao` | Controla visibilidade do card "Classificação" |
| `sections.respostas` | Controla visibilidade da tab "Respostas" |
| `actions[].requiresPermission` | Filtra ações por perfil de usuário |
| `actions[].visible` | Condições dinâmicas (ex: "aceitar" só se !aceiteEm) |

### O que pode ser melhorado 🔧

| Item | Descrição | Esforço |
|------|-----------|---------|
| **Sections não usadas** | `sections.encaminhadoSema` existe no config mas não é usada na UI | Baixo |
| **Hardcoded na DetailPage** | Lógica de "Avaliar Competência" e "Encaminhar para SEMA" está hardcoded (linhas 546-563) | Médio |
| **Tabs hardcoded** | Tabs de "Tramitações", "Respostas", etc. não usam `sections` do config | Médio |
| **Badges hardcoded** | Lógica de badges "Competência confirmada", "Encaminhado à SEMA" está espalhada | Baixo |

---

## Recomendação

**Não refatorar agora.** A refatoração completa seria:
- Alto risco (1500+ linhas de UI)
- Benefício marginal (o workflow já funciona)
- Pode introduzir bugs em produção

**Alternativa:** Criar issues de backlog para melhorias incrementais:
1. Migrar tabs para usar `sections` do config
2. Mover botões "Avaliar Competência" para `actions` do config
3. Centralizar lógica de badges

---

## Conclusão

O W1 original foi **superado** — o workflow config já está sendo usado de forma adequada. As melhorias restantes são refinamentos de UI, não correções de arquitetura.

**Status: ✅ RESOLVIDO** (o config já é aproveitado; melhorias são backlog)
