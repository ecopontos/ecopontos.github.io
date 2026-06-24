# ADR-036: Kanban de Remoção — Cards Automáticos por Caixa de Ecoponto

**Data:** 2026-05-27  
**Status:**Implementado**
**Autores:** Equipe EcoForms

---

## Contexto

Os ADR-034 e ADR-035 propunham uma fila de revisão dedicada com modal customizado de despacho para o gerente de remoção. Durante o refinamento operacional, identificou-se que essa abordagem replicava desnecessariamente a infraestrutura do Kanban já existente.

A operação do departamento de remoção não tem projetos complexos — trabalha com três tipos de demanda:

| Projeto | Origem |
|---|---|
| Remoção de Volumosos Agendada | Ouvidoria |
| Remoção de Descarte Irregular | Ouvidoria + demanda livre |
| Caixas de Ecoponto | `ecopontoCaixasForm` (automático) |

O fluxo real do gerente de remoção é simples: receber o aviso, atribuir um funcionário, acompanhar a execução. Não há decisão de despacho elaborada — o card já chega com o contexto necessário. A infraestrutura de Kanban + `CreateTaskUseCase` atende isso sem refatoração adicional.

---

## Decisão

**Cards Kanban são criados automaticamente por caixa quando a ocupação atinge ≥75%. O dashboard visual sinaliza situações intermediárias (≥50%). O gerente de remoção pode abrir um card manualmente para qualquer nível de ocupação.**

### Regras de criação automática

| Nível de ocupação | Comportamento |
|---|---|
| < 50% | Exibição normal no dashboard |
| ≥ 50% e < 75% | Destaque visual no dashboard (indicador amarelo); **sem card automático** |
| ≥ 75% | Card criado automaticamente no Kanban + destaque laranja no dashboard |
| 100% | Card criado automaticamente + destaque vermelho crítico no dashboard |

A criação automática é **por caixa**, não por ecoponto. Cada tipo de caixa crítica gera seu próprio card — consistente com a capacidade operacional de 1–2 caixas por viagem de caminhão.

### Payload do card gerado automaticamente

```typescript
{
  titulo:      "[Tipo] [Ocupação%] — Ecoponto N",
  // ex: "Entulho 100% — Ecoponto 3"
  status:      'a_fazer',
  prioridade:  ocupacao === '100' ? 'alta' : 'media',
  projeto_id:  'caixas-ecoponto',
  origem_tipo: 'ecopontoCaixasForm',
  interessado: user_id do operador que submeteu o form,
  setor_id:    setor-remocao,
  form_data: {
    ecoponto_id:   string,
    tipo_caixa:    string,
    ocupacao:      string,        // '75' | '100'
    aviso_uuid:    string,        // uuid do registro submetido
    caixa_id:      number,        // id da caixa no form (1–7)
  }
}
```

### Idempotência

Antes de criar o card, o sistema verifica se já existe uma tarefa aberta com `form_data.ecoponto_id + form_data.caixa_id` e `status ≠ 'concluido'`. Se existir, **não duplica** — atualiza apenas o campo `ocupacao` no `form_data` da tarefa existente.

Isso cobre o caso em que o operador submete múltiplos forms no mesmo turno sem que a coleta tenha ocorrido.

### Criação manual pelo gerente de remoção

O gerente pode criar um card para qualquer caixa em qualquer nível de ocupação diretamente pelo dashboard de caixas (`/remocao/painel`). O card criado manualmente segue o mesmo payload, com `form_data.origem = 'manual'`.

Caso de uso: caixa a 50% em ecoponto próximo a outro com coleta já agendada — economicamente faz sentido buscar as duas na mesma viagem.

### Fechamento automático por correlação

Quando um novo `ecopontoCaixasForm` é submetido:

```
Para cada caixa no novo form:
  se ocupacao ≤ 50% OU marcada como removida:
    buscar tarefa aberta com:
      form_data.ecoponto_id = ecoponto atual
      form_data.caixa_id    = caixa atual
      status ≠ 'concluido'
    → fechar tarefa:
        status             = 'concluido'
        origem_fechamento  = 'form_automatico'
        concluido_em       = timestamp do novo form
```

O operador do ecoponto não precisa de nenhuma ação adicional além do seu workflow natural: submeter o form depois que o caminhão parte. O sistema interpreta a queda de ocupação como confirmação da coleta.

---

## Impacto nos ADRs anteriores

**ADR-034 — Fila de Revisão e Despacho**: supersedido nos seguintes pontos:
- A fila de revisão dedicada não é implementada — o Kanban é a fila
- O modal customizado de despacho não é implementado — o card padrão do Kanban é suficiente
- O gerente de remoção atribui funcionário e move o card; não há ação de "despacho" separada
- A diferenciação por setor (`setor-remocao`) para visibilidade das ações permanece válida
- O conceito de ponte externa (Telegram/WhatsApp) para notificação da equipe permanece válido como camada futura

**ADR-035 — Navegação do Módulo**: simplificado:
- A aba "Avisos" é substituída pelo board Kanban filtrado por `projeto_id = 'caixas-ecoponto'`
- A estrutura `/remocao` com duas abas se mantém: "Painel" (dashboard de ocupação) e "Board" (Kanban de remoção)
- `CaixasDetailModal` customizado não é necessário; o modal padrão de card Kanban é usado

---

## Estrutura do módulo `/remocao` (revisão do ADR-035)

```
/remocao
├── Aba "Painel"  — dashboard de ocupação por ecoponto
│     cards com indicadores visuais por nível
│     botão "Abrir tarefa" disponível para gerente de remoção em qualquer nível
└── Aba "Board"   — Kanban filtrado por projeto caixas-ecoponto
      colunas: a_fazer | em_andamento | concluido
      cards com tipo de caixa, ecoponto, % ocupação
      gerente atribui funcionário e move card
```

Ambos os gerentes (ecopontos e remoção) acessam `/remocao`. O botão "Abrir tarefa manualmente" no Painel é visível apenas para o gerente de remoção (setor-remocao).

---

## Onde vive a lógica de criação automática

A criação do card é disparada diretamente no processamento do evento `ecoforms.registro.criado` no `HandlerRegistry` do desktop. **Não há camada intermediária de Solicitações** — a tarefa entra no Kanban em `a_fazer` imediatamente.

```typescript
// HandlerRegistry — handler para ecoforms.registro.criado
if (envelope.data.tipo_form === 'ecopontoCaixasForm') {
  const caixasData = envelope.data.form_data?.caixas_list ?? {};
  const ocupacao = caixasData.ocupacao ?? {};
  for (const [caixaId, nivel] of Object.entries(ocupacao)) {
    const nivelNum = parseInt(nivel as string);
    if (nivelNum >= 75) {
      await autoCreateRemocaoTask(envelope, caixaId, nivel as string, db);
    } else if (nivelNum <= 50 || caixasData.removidas?.[caixaId]) {
      await fecharTaskCorrelacionada(envelope, caixaId, db);
    }
  }
}
```

A lógica de correlação e fechamento executa na direção inversa quando `ocupacao ≤ 50` ou `removida = true`.

### Geração de IDs

Todos os IDs de tarefas criados automaticamente usam **UUIDv7** via `import { uuidv7 } from 'ecoforms-core'`. Não usar `crypto.randomUUID()` nem UUID v4 — o UUIDv7 é o padrão do projeto e garante ordenação temporal sem índice adicional.

```typescript
import { uuidv7 } from 'ecoforms-core';

const taskId = uuidv7(); // sempre — em criação manual e automática
```

### Fluxo por nível de ocupação

| Nível | Comportamento |
|---|---|
| ≥ 75% | Tarefa criada diretamente em `a_fazer` no Kanban |
| ≥ 50% e < 75% | Destaque visual no dashboard; **sem tarefa, sem Solicitação** |
| ≤ 50% ou `removida = true` | Fecha tarefa correlacionada aberta (se existir) |

O módulo de Solicitações **não é envolvido** neste fluxo. A seção "Integração com Solicitações" de versões anteriores deste ADR foi descartada — a criação direta é mais simples e não requer alteração de queries de visibilidade nem serviço intermediário.

---

## Dashboard `/remocao/painel` — analytics de ocupação e fluxo

O painel não apenas exibe o estado atual: consulta `registro_dados` para mostrar histórico de ocupação e tendência de uso por caixa.

### Fontes de dados

| Tabela | `tipo` | Conteúdo relevante |
|---|---|---|
| `registro_dados` | `ecopontoCaixasForm` | Snapshots de ocupação das 7 caixas com timestamp |
| `registro_dados` | `ecopontoForm` | Visitas de cidadãos: `placa`, `residuos` (array), `ecoponto`, `data`, `hora` |

### Indicadores calculados

**1. Histórico de ocupação por caixa**
Sequência de snapshots de `ecopontoCaixasForm` ordenados por `criado_em`, filtrados por `ecoponto`. Usado para o gráfico de linha de ocupação ao longo do tempo.

**2. Usuários/hora por tipo de caixa**
Conta atendimentos do `ecopontoForm` agrupados por hora do dia, filtrados pelo tipo de resíduo correspondente à caixa:

```sql
SELECT
    strftime('%H', json_extract(conteudo, '$.hora')) AS hora,
    COUNT(*) AS visitas
FROM registro_dados
WHERE tipo = 'ecopontoForm'
  AND json_extract(conteudo, '$.ecoponto') = :ecoponto_id
  AND EXISTS (
      SELECT 1 FROM json_each(json_extract(conteudo, '$.residuos'))
      WHERE value = :residuo_tipo
  )
GROUP BY hora
ORDER BY hora
```

**3. Média de participação por veículo no ciclo anterior**
Para cada caixa, detecta o último evento de troca (ocupação cai de ≥75% para ≤25%, ou `removida = true`) e calcula a taxa de visitas únicas no período:

```sql
SELECT
    COUNT(*) AS total_visitas,
    COUNT(DISTINCT json_extract(conteudo, '$.placa')) AS veiculos_distintos,
    CAST(COUNT(*) AS REAL) /
        NULLIF(COUNT(DISTINCT json_extract(conteudo, '$.placa')), 0) AS media_visitas_por_veiculo
FROM registro_dados
WHERE tipo = 'ecopontoForm'
  AND json_extract(conteudo, '$.ecoponto') = :ecoponto_id
  AND criado_em BETWEEN :inicio_ciclo AND :fim_ciclo
  AND EXISTS (
      SELECT 1 FROM json_each(json_extract(conteudo, '$.residuos'))
      WHERE value = :residuo_tipo
  )
```

Esse número ajuda o gerente a perceber se a caixa está sendo alimentada por poucos usuários recorrentes (alta média) ou por tráfego diverso (média baixa) — o que indica velocidades de enchimento diferentes para o ciclo atual.

### Mapeamento resíduo → caixa

| Resíduo (`ecopontoForm`) | Caixa (`ecopontoCaixasForm`) |
|---|---|
| `entulhos` | Entulho |
| `madeiras` | Madeira |
| `podas` | Poda |
| `reciclavel` | Reciclável |
| `sucata-metal` | Sucata |
| `vidros` | Vidro |
| demais (eletrônico, pilhas, etc.) | Rejeito (estimado) |

A caixa Rejeito não tem resíduo dedicado no `ecopontoForm` — o volume é estimado pelo total de visitas menos as visitas com resíduo mapeado.

### Nota de implementação

O `ecopontoForm` usa campos separados `data` (`date`) e `hora` (`time`). Queries temporais agrupam por hora via `json_extract(conteudo, '$.hora')`. O campo `criado_em` do registro é usado para ordenação e filtro de período.

---

## Alternativas consideradas

### Threshold ≥50% para criação automática (descartada)

Gera volume excessivo de cards — a maioria das caixas a 50% não requer coleta imediata. O dashboard visual cobre a necessidade de visibilidade sem poluir o board de remoção com tarefas prematuras.

### Card por ecoponto agregando todas as caixas críticas (descartada)

Incompatível com a capacidade operacional de 1–2 caixas por viagem. Um card por ecoponto forçaria o gerente a dividir manualmente o trabalho; um card por caixa já reflete a unidade natural de trabalho do caminhão.

### Fila de revisão dedicada — ADR-034 (supersedida)

O Kanban já é uma fila de trabalho. Uma fila paralela criaria dois sistemas para gerenciar o mesmo fluxo, aumentando a carga cognitiva do gerente e a superfície de refatoração.

### Threshold configurável por tipo de caixa (adiada)

Rejeito a 75% pode ser mais urgente que Poda a 100% por razões regulatórias. Configurabilidade por tipo é válida como evolução futura — o campo `prioridade` no card já acomoda urgência diferenciada sem alterar o threshold de criação.

---

## Consequências

### Positivas

- Zero nova UI de despacho — o Kanban existente absorve o fluxo completo
- O operador do ecoponto não muda nada — o workflow natural fecha as tarefas
- O gerente de remoção tem três projetos bem delimitados em um único board
- Idempotência garante que múltiplos envios no turno não geram cards duplicados
- Criação manual dá autonomia ao gerente para antecipar coletas eficientes por rota

### Negativas / Riscos

- **Fechamento automático com falso positivo**: se o operador registrar 0% por engano e depois corrigir, a tarefa já terá sido fechada. Mitigado pela possibilidade de reabrir o card manualmente e pelo histórico de submissões no `form_data`
- **Delay de sync**: o card aparece no Kanban apenas após o ciclo de sync mobile → desktop (≈60s). Em situações críticas o operador pode submeter o form e o gerente não ver imediatamente. Aceitável dado o contexto operacional (não é resposta a emergências em tempo real)
- **Threshold fixo em 75%**: tipos de resíduo com criticidade diferenciada não são cobertos. Endereçado na alternativa "threshold por tipo" como evolução futura

### Sem mudança

- `CreateTaskUseCase` — reutilizado sem modificação
- Schema de tarefas Kanban — `form_data` é JSONB extensível
- Pipeline de sync mobile (`TarefasSyncService`, `InboundService`) — intacto
- `ecopontoCaixasForm` e ADR-032, ADR-033 — intactos
- Projetos Ouvidoria e demanda livre — intactos
- Módulo Kanban (`KanbanBoard`, `EditTaskModal`, `ActionRegistry`) — intacto
- Módulo Solicitações — intacto; não é envolvido neste fluxo
- Lógica de visibilidade por setor no `ActionRegistry` — intacta

---

## Referências

- `ADR-032` — estado persistente no ecopontoCaixasForm
- `ADR-033` — `ecoponto_id` no perfil do usuário
- `ADR-034` — fila de revisão (parcialmente supersedido)
- `ADR-035` — navegação do módulo (simplificado)
- `desktop/src/application/task/CreateTaskUseCase.ts`
- `desktop/src/infrastructure/sync/HandlerRegistry` — ponto de extensão para criação automática
- `desktop/app/caixas/page.tsx` — dashboard a migrar para `/remocao/painel`
- `desktop/src/infrastructure/persistence/sqlite/queries/data-registry.ts` — queries base sobre `registro_dados` (ponto de partida para analytics do painel)
- `ecoforms-core` — `uuidv7()` para geração de IDs de tarefas
