# Plano Técnico — Fluxo Completo de Ouvidoria Pública Estadual

> Versão: 1.1
> Escopo: Adaptar o módulo de manifestações ao fluxo da Subsecretaria de Resíduos, com avaliação de competência, classificação administrativa, cobrança automática e resposta formatada.

---

## 1. Contexto institucional

O módulo atende a **Subsecretaria de Resíduos**. Ao receber uma manifestação, o ouvidor avalia se ela é de competência deste órgão:

- **Compete** → segue o fluxo interno (análise, classificação, encaminhamento setorial, resposta ao cidadão).
- **Não compete** → a manifestação é encaminhada externamente para a **Ouvidoria da Secretaria de Meio Ambiente (SEMA)** e encerrada aqui.

---

## 2. Gaps atuais

O sistema possui a infraestrutura base (state machine, tramitações, prazos, eventos de domínio), mas faltam:

| Gap | Impacto |
|---|---|
| Sem decisão formal de competência | Manifestações fora de escopo ficam no fluxo indevidamente |
| Sem classificação administrativa | Subassunto, subunidade e programa orçamentário ausentes |
| Sem distinção de tipo de tramitação | Encaminhamento interno ≠ transferência setorial ≠ cobrança |
| Sem cobrança automática por prazo | Prazos vencidos passam sem notificação |
| Sem editor/formatador de resposta | Resposta ao cidadão é texto livre sem padronização |
| Sem canal de envio ao cidadão | Não há registro de e-mail, portal ou impressão |

---

## 3. Fluxo alvo

```
┌──────────────────────┐
│      Recebimento     │  status: 'aberta' — protocolo gerado automaticamente
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Análise Preliminar  │  status: 'em_analise'
│  (Ouvidor avalia)    │
└──────────┬───────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
 Compete?    Não compete
     │            │
     │            ▼
     │   ┌──────────────────────────┐
     │   │  Encaminha para Ouvidoria │  status: 'encaminhado_sema' (terminal)
     │   │  da SEMA + registra motivo│
     │   └──────────────────────────┘
     │
     ▼
┌──────────────────────┐
│  Classificação Admin │  Subassunto, subunidade, programa orçamentário
│  (Ouvidor classifica)│  Botão "Classificar e Encaminhar" → 'em_atendimento'
└──────────┬───────────┘
           │
     ┌─────┴──────────────┐
     ▼                    ▼
Setor correto?     Setor errado?
     │                    │
     ▼                    ▼
Encaminha área       Transfere para
interna              setor competente
(tipo: encaminhamento)  (tipo: transferencia)
     │
     ▼
┌──────────────────────┐
│  Área interna responde│  Despacho técnico / resposta interna
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Verificação de Prazo │  Job periódico — se vencido → cobrança automática
│  + Cobrança Auto     │  status prazo: 'pendente' → cobranca_enviada = 1
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Formatação da Resposta│  Ouvidor seleciona modelo + adapta texto
│  + Envio ao Cidadão  │  status: 'respondida'
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│       Concluída      │  status: 'encerrada' — avaliação de satisfação
└──────────────────────┘
```

---

## 4. State machine atualizada

```typescript
export type ManifestacaoStatus =
  | 'aberta'
  | 'em_analise'
  | 'em_atendimento'
  | 'respondida'
  | 'em_avaliacao'
  | 'devolvida'
  | 'encaminhado_sema'  // novo — terminal externo
  | 'cancelada'
  | 'encerrada';

const TRANSICOES_VALIDAS: Record<ManifestacaoStatus, ManifestacaoStatus[]> = {
  aberta:           ['em_analise', 'cancelada'],
  em_analise:       ['em_atendimento', 'encaminhado_sema', 'devolvida', 'cancelada'],
  //                  ↑ verificação de competência e classificação acontecem aqui
  em_atendimento:   ['respondida', 'devolvida'],
  respondida:       ['em_avaliacao', 'encerrada'],
  em_avaliacao:     ['encerrada', 'em_atendimento'],
  devolvida:        ['em_analise'],
  encaminhado_sema: [],  // terminal — encaminhamento externo para Ouvidoria da SEMA
  cancelada:        [],  // terminal
  encerrada:        [],  // terminal
};
```

---

## 5. Fases de implementação

### Fase 1 — Decisão de Competência

**Schema**
```sql
ALTER TABLE manifestacoes ADD COLUMN competencia TEXT
  CHECK(competencia IN ('compete', 'nao_compete', 'pendente')) DEFAULT 'pendente';
ALTER TABLE manifestacoes ADD COLUMN motivo_incompetencia TEXT;
ALTER TABLE manifestacoes ADD COLUMN orgao_destino TEXT;   -- 'Ouvidoria da SEMA'
ALTER TABLE manifestacoes ADD COLUMN data_competencia TEXT;
```

**Domain**
- Adicionar `encaminhado_sema` ao tipo `ManifestacaoStatus` e à state machine
- Adicionar evento `CompetenciaVerificada` em `ManifestacaoEvents.ts`
- Adicionar método `verificarCompetencia(id, competencia, motivo?, orgaoDestino?)` no `ManifestacaoRepository`

```typescript
// ManifestacaoEvents.ts
export const CompetenciaVerificada = 'manifestacao.competencia_verificada';
export interface CompetenciaVerificadaPayload {
  manifestacaoId: string;
  competencia: 'compete' | 'nao_compete';
  motivo?: string;
  orgaoDestino?: string;
}
```

**Regra**
```typescript
if (competencia === 'nao_compete') {
  ManifestacaoStateMachine.validarTransicao(manifestacao.status, 'encaminhado_sema');
  await repo.updateStatus(id, 'encaminhado_sema');
  await repo.verificarCompetencia(id, 'nao_compete', motivo, 'Ouvidoria da SEMA');
  await repo.addTramitacao({
    tipo: 'transferencia',
    observacao: `Encaminhado para Ouvidoria da SEMA. Motivo: ${motivo}`,
  });
}
```

**UI** (visível apenas para ouvidor/coordenador, quando status = `em_analise`)
- Botão "Avaliar Competência"
- Modal: "Esta manifestação é de competência da Subsecretaria de Resíduos?"
  - **Sim** → marca `competencia = compete`, habilita campos de classificação (Fase 2)
  - **Não** → exige motivo (textarea obrigatório), confirma "Encaminhar para Ouvidoria da SEMA", status → `encaminhado_sema`

---

### Fase 2 — Classificação Administrativa

**Schema**
```sql
ALTER TABLE manifestacoes ADD COLUMN subassunto_id TEXT;
ALTER TABLE manifestacoes ADD COLUMN subunidade_id TEXT;
ALTER TABLE manifestacoes ADD COLUMN programa_orcamentario_id TEXT;

CREATE TABLE IF NOT EXISTS subassuntos (
  id   TEXT PRIMARY KEY,
  assunto_id TEXT NOT NULL REFERENCES classificacoes(id),
  nome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subunidades (
  id            TEXT PRIMARY KEY,
  setor_id      TEXT NOT NULL REFERENCES setores(id),
  nome          TEXT NOT NULL,
  responsavel_id TEXT REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS programas_orcamentarios (
  id       TEXT PRIMARY KEY,
  codigo   TEXT NOT NULL,
  nome     TEXT NOT NULL,
  exercicio INTEGER NOT NULL
);
```

**Domain**
- `ManifestacaoInput` ganha campos opcionais: `subassunto_id`, `subunidade_id`, `programa_orcamentario_id`
- Evento `ManifestacaoClassificada`

```typescript
export const ManifestacaoClassificada = 'manifestacao.classificada';
export interface ManifestacaoClassificadaPayload {
  manifestacaoId: string;
  subassuntoId?: string;
  subunidadeId?: string;
  programaOrcamentarioId?: string;
}
```

**UI** (exibido quando `competencia = compete` e status = `em_analise`)
- Select cascata: Assunto → Subassunto
- Select cascata: Setor → Subunidade
- Select: Programa Orçamentário
- Botão "Classificar e Encaminhar" → salva classificação e move para `em_atendimento`

---

### Fase 3 — Distribuição e Transferência Setorial

**Schema**
```sql
ALTER TABLE tramitacoes ADD COLUMN tipo_tramitacao TEXT
  CHECK(tipo_tramitacao IN ('encaminhamento', 'transferencia', 'devolucao', 'cobranca'))
  DEFAULT 'encaminhamento';
```

**Domain**
- `Tramitacao` ganha campo `tipoTramitacao`
- Regra: `tipoTramitacao === 'transferencia'` exige `paraSetorId` diferente do setor atual
- Evento `ManifestacaoTransferida`

**UI**
- Botão "Transferir para Outro Setorial" (ouvidor) → cria tramitação tipo `transferencia`
- Botão "Encaminhar para Área Interna" (setor responsável) → cria tramitação tipo `encaminhamento`
- Histórico de tramitações exibe badge com o tipo: `encaminhamento`, `transferência`, `devolução`, `cobrança`

---

### Fase 4 — Cobrança Automática por Prazo

**Schema**
```sql
ALTER TABLE prazos ADD COLUMN cobranca_enviada INTEGER NOT NULL DEFAULT 0;
ALTER TABLE prazos ADD COLUMN data_cobranca TEXT;
ALTER TABLE notificacoes ADD COLUMN prazo_id TEXT REFERENCES prazos(id);
```

**Application — Job periódico**

Executado via `setInterval` registrado no `SyncContext` ao iniciar o app (a cada 60 min).

```typescript
// application/ouvidoria/VerificarPrazosVencidosJob.ts
export async function verificarPrazosVencidos(
  sqlite: SqlitePort,
  bus: DomainEventBus,
): Promise<void> {
  const vencidos = await sqlite.query<{
    id: string; manifestacao_id: string; tipo_prazo: string; data_limite: string;
  }>(`
    SELECT id, manifestacao_id, tipo_prazo, data_limite
    FROM prazos
    WHERE status = 'pendente'
      AND datetime(data_limite) < datetime('now')
      AND cobranca_enviada = 0
  `);

  for (const p of vencidos) {
    await sqlite.execute(
      `INSERT INTO notificacoes (id, usuario_id, manifestacao_id, mensagem, lida, criado_em, prazo_id)
       SELECT ?, u.id, ?, ?, 0, ?, ?
       FROM usuarios u
       JOIN manifestacoes m ON u.setor_id = m.setor_id
       WHERE m.id = ?`,
      [crypto.randomUUID(), p.manifestacao_id,
       `Cobrança: prazo de ${p.tipo_prazo} vencido em ${p.data_limite}`,
       new Date().toISOString(), p.id, p.manifestacao_id],
    );
    await sqlite.execute(
      `UPDATE prazos SET cobranca_enviada = 1, data_cobranca = ? WHERE id = ?`,
      [new Date().toISOString(), p.id],
    );
    bus.publish(PrazoVencido, { prazoId: p.id, manifestacaoId: p.manifestacao_id, dataLimite: p.data_limite });
  }
}
```

**Domain**
```typescript
export const PrazoVencido    = 'prazo.vencido';
export const CobrancaEnviada = 'cobranca.enviada';
export interface PrazoVencidoPayload {
  prazoId: string;
  manifestacaoId: string;
  dataLimite: string;
}
```

**UI**
- Badge "Prazo Vencido" na lista de manifestações (quando `prazoLimite < hoje` e status ≠ terminal)
- Aba "Cobranças" na tela de detalhe com histórico de notificações automáticas

---

### Fase 5 — Editor e Formatador de Resposta

**Schema**
```sql
ALTER TABLE respostas ADD COLUMN resposta_formatada TEXT;
ALTER TABLE respostas ADD COLUMN modelo_id TEXT;
ALTER TABLE respostas ADD COLUMN revisada_por TEXT REFERENCES usuarios(id);
ALTER TABLE respostas ADD COLUMN data_revisao TEXT;

CREATE TABLE IF NOT EXISTS modelos_resposta (
  id                   TEXT PRIMARY KEY,
  tipo_manifestacao_id TEXT NOT NULL,
  assunto_id           TEXT,
  titulo               TEXT NOT NULL,
  corpo                TEXT NOT NULL,
  ativo                INTEGER NOT NULL DEFAULT 1
);
```

**Domain**
- `Resposta` ganha campos: `respostaFormatada`, `modeloId`, `revisadaPor`, `dataRevisao`
- Evento `RespostaFormatada`

**UI** — Botão "Formatar Resposta" na aba Respostas:
1. Select de modelos filtrados por tipo/assunto da manifestação
2. Textarea pré-preenchido com o modelo selecionado (editável)
3. Preview da resposta formatada
4. Botão "Salvar Rascunho" (sem mudar status) vs "Marcar como Respondida" (→ `respondida`)
- `revisadaPor` preenchido automaticamente com o usuário logado

---

### Fase 6 — Canal de Envio ao Cidadão (futuro)

**Schema**
```sql
CREATE TABLE IF NOT EXISTS envios_resposta (
  id              TEXT PRIMARY KEY,
  resposta_id     TEXT NOT NULL REFERENCES respostas(id),
  manifestacao_id TEXT NOT NULL REFERENCES manifestacoes(id),
  canal           TEXT NOT NULL CHECK(canal IN ('email', 'portal', 'impresso')),
  destinatario    TEXT,
  status_envio    TEXT NOT NULL DEFAULT 'pendente'
                    CHECK(status_envio IN ('pendente', 'enviado', 'falha')),
  data_envio      TEXT,
  erro            TEXT
);
```

**Application — `EnviarRespostaUseCase`**
1. Valida que a resposta formatada existe
2. Registra o canal em `envios_resposta`
3. Move status da manifestação para `respondida`
4. (Futuro) Integra com serviço de e-mail ou API do portal da SEMA

**UI**
- Botão "Enviar ao Cidadão" com seleção de canal: E-mail / Portal / Imprimir (PDF)

---

## 6. Eventos de domínio

```typescript
// domain/ouvidoria/ManifestacaoEvents.ts

export const CompetenciaVerificada   = 'manifestacao.competencia_verificada';
export const ManifestacaoClassificada = 'manifestacao.classificada';
export const ManifestacaoTransferida  = 'manifestacao.transferida';
export const PrazoVencido             = 'prazo.vencido';
export const CobrancaEnviada          = 'cobranca.enviada';
export const RespostaFormatada        = 'resposta.formatada';

export interface CompetenciaVerificadaPayload {
  manifestacaoId: string;
  competencia: 'compete' | 'nao_compete';
  motivo?: string;
  orgaoDestino?: string;
}
export interface ManifestacaoClassificadaPayload {
  manifestacaoId: string;
  subassuntoId?: string;
  subunidadeId?: string;
  programaOrcamentarioId?: string;
}
export interface PrazoVencidoPayload {
  prazoId: string;
  manifestacaoId: string;
  dataLimite: string;
}
```

---

## 7. Checklist de implementação

| # | Fase | Tarefa | Arquivo(s) |
|---|------|--------|------------|
| 1 | 1 | Add colunas `competencia`, `motivo_incompetencia`, `orgao_destino`, `data_competencia` | `scripts/ensure-columns.ts` |
| 2 | 1 | Add status `encaminhado_sema` na state machine | `domain/ouvidoria/ManifestacaoStateMachine.ts` |
| 3 | 1 | Add evento `CompetenciaVerificada` | `domain/ouvidoria/ManifestacaoEvents.ts` |
| 4 | 1 | Add método `verificarCompetencia` no repository e impl SQLite | `domain/ouvidoria/ManifestacaoRepository.ts`, `infrastructure/persistence/sqlite/SqliteManifestacaoRepository.ts` |
| 5 | 1 | UI: botão + modal de avaliação de competência | `app/manifestacoes/[id]/ManifestacaoDetailPage.tsx` |
| 6 | 2 | Criar tabelas `subassuntos`, `subunidades`, `programas_orcamentarios` | `scripts/ensure-columns.ts` |
| 7 | 2 | Add campos de classificação no `ManifestacaoInput` e repository | `domain/ouvidoria/ManifestacaoRepository.ts`, `SqliteManifestacaoRepository.ts` |
| 8 | 2 | Add evento `ManifestacaoClassificada` | `domain/ouvidoria/ManifestacaoEvents.ts` |
| 9 | 2 | UI: selects cascata (assunto→subassunto, setor→subunidade, programa) | `app/manifestacoes/[id]/ManifestacaoDetailPage.tsx` |
| 10 | 3 | Add coluna `tipo_tramitacao` em tramitacoes | `scripts/ensure-columns.ts` |
| 11 | 3 | Add campo `tipoTramitacao` no domain + regra de validação | `domain/ouvidoria/ManifestacaoRepository.ts` |
| 12 | 3 | Add evento `ManifestacaoTransferida` | `domain/ouvidoria/ManifestacaoEvents.ts` |
| 13 | 3 | UI: botões Transferir / Encaminhar + badges na tabela de tramitações | `app/manifestacoes/[id]/ManifestacaoDetailPage.tsx` |
| 14 | 4 | Add colunas `cobranca_enviada`, `data_cobranca` em prazos; `prazo_id` em notificacoes | `scripts/ensure-columns.ts` |
| 15 | 4 | Criar `VerificarPrazosVencidosJob.ts` | `application/ouvidoria/VerificarPrazosVencidosJob.ts` |
| 16 | 4 | Registrar job com `setInterval` no `SyncContext` | `contexts/SyncContext.tsx` |
| 17 | 4 | UI: badge "Prazo Vencido" na lista + aba "Cobranças" no detalhe | `app/manifestacoes/page.tsx`, `app/manifestacoes/[id]/ManifestacaoDetailPage.tsx` |
| 18 | 5 | Criar tabela `modelos_resposta`; add colunas em `respostas` | `scripts/ensure-columns.ts` |
| 19 | 5 | Add campos de formatação no domain `Resposta` | `domain/ouvidoria/ManifestacaoRepository.ts` |
| 20 | 5 | UI: editor de resposta com seleção de modelos e preview | `app/manifestacoes/[id]/ManifestacaoDetailPage.tsx` |
| 21 | 6 | Criar tabela `envios_resposta` | `scripts/ensure-columns.ts` |
| 22 | 6 | Criar `EnviarRespostaUseCase` | `application/ouvidoria/EnviarRespostaUseCase.ts` |

---

## 8. Considerações técnicas

- **Migrações aditivas**: todos os `ALTER TABLE` usam `.catch(() => {})` para não falhar em bancos já migrados.
- **Verificação de competência em `em_analise`**: a state machine não permite `encaminhado_sema` a partir de `aberta` — o ouvidor precisa analisar antes de decidir.
- **Job de cobrança**: executado via `setInterval` (60 min) registrado no `SyncContext`; não depende de cron externo.
- **Permissões**: `verificarCompetencia` e `classificar` requerem perfil `ouvidor` ou `coordenador`; `transferir` requer `ouvidor`; `formatarResposta` requer `ouvidor` ou `gerente`.
- **SLA**: `SlaCalculator` já existe — o job apenas consome `data_limite` gerado por ele.
- **Testes**: cada nova transição de status deve ter teste unitário em `ManifestacaoStateMachine`.
