# ADR-035: Estrutura de Navegação do Módulo de Remoção

**Data:** 2026-05-27  
**Status:**Implementado** (simplificado pelo ADR-036)
**Autores:** Equipe EcoForms

---

## Contexto

O módulo de caixas de ecoponto (ADR-034) originou dois pontos de entrada distintos para o mesmo dado:

1. **Dashboard** (`app/caixas/page.tsx`) — visão agregada e estática do estado atual de todas as caixas. Existente, read-only, sem ações.
2. **Fila de revisão** — lista de avisos pendentes gerados pelas submissões do `ecopontoCaixasForm`, com ações de despacho para o gerente de remoção.

Manter esses dois pontos em rotas separadas (`/caixas` e uma nova `/fila-remocao`) criaria:

- Fragmentação de contexto: o gerente de remoção precisaria alternar entre duas páginas para ter o panorama e agir
- Modal duplicado ou inconsistente: `CaixasDetailModal` aberto de duas rotas diferentes com comportamentos potencialmente divergentes
- Navegação ambígua para o gerente de ecopontos, que só precisa do painel

---

## Decisão

**O módulo é consolidado em uma única rota `/remocao` com duas abas. O `CaixasDetailModal` é um componente único compartilhado entre as duas abas.**

### Estrutura da rota

```
/remocao
├── Aba "Painel"   — dashboard de ocupação (todos os ecopontos)
└── Aba "Avisos"   — fila de revisão de submissões pendentes
```

### Aba Painel

- Migração e renomeação do `app/caixas/page.tsx`
- Cards clicáveis de todos os ecopontos com indicadores de ocupação
- Abre `CaixasDetailModal` ao clicar em qualquer card
- Disponível para ambos os perfis (gerente ecopontos e gerente remoção)

### Aba Avisos

- Lista de itens pendentes, ordenada por criticidade (ocupação máxima) e horário de envio
- Badge numérico na aba indicando pendentes não vistos
- Cada item abre o mesmo `CaixasDetailModal`
- Item marcado como `visto` ao fechar o modal (independente de despacho)
- Disponível para ambos os perfis; ação de despacho visível apenas para gerente de remoção

### `CaixasDetailModal` — componente único

O modal recebe o contexto de origem via prop mas comporta ambos os casos:

```typescript
type CaixasDetailModalProps = {
  ecoponto: EcopontoStatus;
  origem: 'painel' | 'aviso';
  avisoId?: string;          // presente quando origem === 'aviso'
  onDespachar: (payload) => void;
  onMarcarVisto?: () => void;
  onClose: () => void;
};
```

- **Dados exibidos**: idênticos nas duas origens — OccupationRenderer read-only, timestamp, resumo
- **Ações disponíveis**:

| Ação | Painel | Avisos | Restrição |
|---|---|---|---|
| Despachar coleta | Sim | Sim | setor-remocao |
| Marcar como visto | Não | Sim | qualquer gerente |
| Fechar | Sim | Sim | — |

### Acesso por perfil

| Perfil | Rota visível | Aba padrão ao entrar |
|---|---|---|
| Gerente de Ecopontos | `/remocao` | Painel |
| Gerente de Remoção | `/remocao` | Avisos (se houver pendentes) |
| Admin | `/remocao` | Painel |

A aba padrão para o gerente de remoção muda para Painel quando não há avisos pendentes.

---

## Estrutura de arquivos

```
app/
└── remocao/
    └── page.tsx              ← rota principal, gerencia estado de aba ativa

components/
└── remocao/
    ├── PainelCaixas.tsx      ← migração de app/caixas/page.tsx
    ├── FilaAvisos.tsx        ← lista de itens pendentes
    └── CaixasDetailModal.tsx ← modal único compartilhado
```

`app/caixas/page.tsx` é removido ou redirecionado para `/remocao`.

---

## Alternativas consideradas

### Duas rotas separadas `/caixas` e `/avisos-remocao` (descartada)

Manter o dashboard existente e criar uma rota separada para a fila. Descartada porque:
- O gerente de remoção precisaria de duas entradas no menu de navegação para o mesmo domínio
- O `CaixasDetailModal` teria que ser instanciado em dois contextos de rota diferentes, aumentando o risco de divergência comportamental
- Não resolve o problema de contexto: agir na fila sem ver o painel perde a visão de prioridade relativa entre ecopontos

### Modal diferente por origem (descartado)

Criar `CaixasDetailModal` para o painel e `AvisoDetailModal` para a fila. Descartado porque os dados exibidos são idênticos — a duplicação seria de template, não de lógica. A prop `origem` resolve a diferença de comportamento com custo mínimo.

### Fila como painel lateral (descartada)

Exibir a fila como sidebar ao lado do dashboard em vez de aba separada. Descartada porque em telas menores (notebook) a densidade ficaria alta, e o fluxo de revisão da fila (abrir modal, agir, fechar, próximo item) é mais limpo em tela cheia do que em painel lateral.

---

## Consequências

### Positivas

- Um único ponto de entrada no menu para o domínio de remoção
- `CaixasDetailModal` mantido como componente único — sem risco de divergência entre origens
- O gerente de remoção tem contexto (painel) e ação (avisos) na mesma rota
- Badge na aba Avisos funciona como indicador passivo — o gerente não precisa checar ativamente
- `app/caixas/page.tsx` é absorvido, não duplicado

### Negativas / Riscos

- **Migração da rota existente**: qualquer bookmark ou link direto para `/caixas` precisa de redirect. Baixo impacto (uso interno)
- **Estado de aba ativa**: a lógica de "abrir em Avisos se houver pendentes" requer que a contagem de pendentes seja resolvida no servidor ou carregada antes da hidratação da página. Se a contagem chegar com delay, o usuário vê um flash de aba errada. Mitigado com estado inicial conservador (sempre abre em Painel) e transição suave ao carregar

### Sem mudança

- Schema de tarefas Kanban (definido no ADR-036) — intacto
- Lógica de visibilidade por setor no `ActionRegistry` — intacta
- Pipeline de sync mobile — intacto

---

## Referências

- `ADR-034` — fila de revisão de caixas e despacho para equipe de remoção
- `ADR-032` — estado persistente no ecopontoCaixasForm
- `desktop/app/caixas/page.tsx` — dashboard existente a migrar
- `desktop/components/kanban/SolicitacaoReviewModal.tsx` — padrão de modal a seguir
