# ADR-042: Gaps identificados no módulo Agendamentos

**Data:** 2026-05-29  
**Status:**Implementado**
**Autores:** Equipe EcoForms  
**Escopo da auditoria:** 29 arquivos do módulo agendamentos/booking/slots  
**ADRs relacionados:** ADR-031-desktop (QueryCatalog), ADR-038 (BookingModal), ADR-039 (Manifestações)

---

## Contexto

Auditoria completa do módulo de agendamentos cobrindo domain, application (use cases), infrastructure (SQLite), interface (hooks) e pages/componentes. O módulo possui arquitetura de camadas bem definida mas apresenta problemas sérios de atomicidade, validação e tratamento de erros que podem causar inconsistências de dados em produção.

---

## Gaps Identificados

### Crítico

#### 1. Race condition na confirmação automática de booking (linhas 9–25 de `useAgendamentoMutations.ts`)

```typescript
const agendamentoId = await c.createBookingUseCase.execute(input);
await c.confirmarAgendamentoUseCase.execute(agendamentoId, input.userId);
// Auto-confirm logo após criar — sem re-validar capacidade do slot
```

Entre `createBooking` e `confirmarAgendamento`, outro usuário pode ocupar as últimas vagas. A capacidade é verificada apenas em `CreateBookingUseCase`, não em `ConfirmarAgendamentoUseCase`. Dois bookings simultâneos passam pela criação com vagas disponíveis e ambos são confirmados.

**Decisão:** Verificação de capacidade deve ser atômica. Opções:
- `CreateBookingUseCase` já confirma internamente (one-shot) com lock pessimista via `BEGIN IMMEDIATE`
- Ou `ConfirmarAgendamentoUseCase` re-verifica slot antes de confirmar e lança `SlotLotadoError`

---

#### 2. Ausência de transação em `CreateBookingUseCase` (linhas 84–86)

```typescript
await this.agendamentoRepo.save(agendamento);   // (1) persiste agendamento
await this.slotRepo.save(slot);                  // (2) atualiza vagas — pode falhar
await this.efeitos.aoCriar(agendamento, userId); // (3) cria task, sync event
```

Se o passo (2) falhar, o agendamento existe no banco mas o slot não foi atualizado — vagas descontadas ficam inconsistentes. Se (3) falhar, agendamento existe sem task associada.

**Decisão:** Envolver os passos (1) e (2) em `BEGIN IMMEDIATE ... COMMIT`. O passo (3) (`efeitos.aoCriar`) pode ser compensável — registrar em outbox e executar fora da transação principal.

---

#### 3. Falta de idempotência em `ConfirmarAgendamentoUseCase`

Se a confirmação falha após `agendamento.transitionTo('confirmado')` ser persistido mas antes de `efeitos.aoConfirmar()` completar (criação de task, sync event), o agendamento está em estado `confirmado` sem task. Um retry chama `transitionTo('confirmado')` novamente — a FSM pode rejeitar a transição de um estado já `confirmado`.

**Decisão:** Idempotência por chave: verificar se task já existe antes de criar. `efeitos.aoConfirmar` deve ser reentrant — `INSERT OR IGNORE` nas tabelas de efeitos.

---

#### 4. JSON parse silencioso em `SqliteAgendamentoRepository.rowToEntity`

```typescript
dadosFormulario: (() => {
  try { return JSON.parse(row.dados_formulario || '{}'); } catch { return {}; }
})(),
```

Se `dados_formulario` contém JSON inválido (corrupção, truncamento), retorna `{}` sem log. Dados do formulário são perdidos silenciosamente — validadores downstream recebem objeto vazio e falham com erros não rastreáveis.

**Decisão:** Logar o erro antes de retornar fallback:
```typescript
} catch (err) {
  console.error('[SqliteAgendamentoRepository] dados_formulario inválido para id', row.id, err);
  return {};
}
```

---

### Alto

#### 5. `vagasSolicitadas` sem validação em `CreateBookingUseCase`

Valor pode ser `0`, negativo ou maior que vagas disponíveis sem ser rejeitado explicitamente antes de chegar ao `slot.incrementarVagas()`. A validação de "slot encerrado" existe (linha que compara `dataFim < new Date()`), mas não há:

```typescript
// Ausente:
if (vagas <= 0) throw new BookingValidationError('vagasSolicitadas deve ser >= 1');
if (vagas > (slot.capacidade - slot.vagasOcupadas)) throw new SlotLotadoError();
```

**Decisão:** Adicionar guard no início de `CreateBookingUseCase.execute()`, antes de qualquer acesso ao repositório.

---

#### 6. Catch silencioso em `CreateServiceSlotUseCase` — regra de abertura (linhas 43–52)

```typescript
try {
  const regra: AberturaRegra = JSON.parse(regraRaw);
  // ...
} catch { /* regra inválida — sem restrição */ }
```

Falha no parse da regra de abertura do slot resulta em slot sem restrição — bookings prematuros passam sem controle. Sem log, sem alerta ao operador.

**Decisão:**
```typescript
} catch (err) {
  console.error('[CreateServiceSlotUseCase] abertura_regra inválida:', regraRaw, err);
  throw new Error('Regra de abertura do slot é inválida. Verifique o formato JSON.');
}
```

---

#### 7. WhatsApp link gerado com telefone não validado (`NotificacaoService`)

```typescript
const phone = agendamento.clienteTelefone.replace(/\D/g, '');
const waLink = `https://wa.me/55${phone}?text=${encodeURIComponent(mensagem)}`;
```

Dois problemas:
- `clienteTelefone` pode ser `undefined`/`null` — `.replace()` lança `TypeError`
- `phone` pode ter menos de 10 dígitos — link WhatsApp inválido gravado no banco sem verificação

**Decisão:**
```typescript
if (!agendamento.clienteTelefone) return null; // sem link
const phone = agendamento.clienteTelefone.replace(/\D/g, '');
if (phone.length < 10) return null;
```

---

#### 8. Comparação de datas com string ISO sem parsing em `ServiceSlot.ts` (linha 38)

```typescript
if (props.dataFim < props.dataInicio) throw new Error('...');
```

Comparação lexicográfica de strings ISO. Funciona apenas se o formato é sempre `YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm:ssZ`. Com fusos horários ou formatos mistos, a comparação falha silenciosamente.

**Decisão:** `new Date(props.dataFim) < new Date(props.dataInicio)` — explícito e timezone-safe.

---

#### 9. Sem paginação em `SqliteServiceSlotRepository.findAll`

Query sem `LIMIT`. Em instalações com histórico longo, todos os slots são carregados para memória — degradação de performance e potencial crash em dispositivos com pouca RAM.

**Decisão:** Adicionar `LIMIT` e `OFFSET` com parâmetros opcionais `{ limit?: number; offset?: number }` no contrato do repositório.

---

#### 10. `eslint-disable-next-line react-hooks/exhaustive-deps` em `useServiceSlots` (linha ~24)

```typescript
}, [filtros?.status, filtros?.serviceTypeId, tick]);
// eslint-disable-next-line react-hooks/exhaustive-deps
```

O disable oculta que `filtros` como objeto é comparado por referência — se o caller recria o objeto a cada render (`filtros={{ status: 'publicado' }}`), o hook **não** reexecuta porque as propriedades individuais são as dependências, não o objeto. Se o caller usa `JSON.stringify(filtros)` como dependência (padrão já adotado em `useAgendamentos.ts`), o comportamento fica correto.

**Decisão:** Remover `eslint-disable`, mover para dependência `JSON.stringify(filtros)` consistente com `useAgendamentos`.

---

### Médio

#### 11. Inconsistência no padrão de atualização de vagas

`CreateBookingUseCase` usa o padrão: muta entidade em memória (`slot.incrementarVagas()`) → salva entidade inteira.  
`CancelarAgendamentoUseCase` usa o padrão: chama `slotRepo.updateVagasOcupadas()` direto — update parcial sem passar pela entidade.

Dois padrões para a mesma operação. O segundo contorna a FSM e a validação da entidade.

**Decisão:** Padronizar: sempre mutar via entidade (`slot.decrementarVagas()`) → `slotRepo.save(slot)`. Remover `updateVagasOcupadas()` da interface do repositório.

---

#### 12. Lógica de negócio em `BookingModal` (já mapeado no ADR-038, gaps 1–4)

Referenciar: `handleQuickCreate`, `handleFormSubmit`, `buildEnderecoCompleto`, fetch CEP com masking — tudo em componente React. Listado aqui para consolidar escopo do módulo.

---

#### 13. Status de agendamento e slot sem constraint no banco

Valores de `status` são strings livres. Sem `CHECK` constraint no SQLite:
```sql
-- Ausente:
CHECK (status IN ('pendente', 'confirmado', 'realizado', 'cancelado'))
CHECK (status IN ('rascunho', 'publicado', 'encerrado', 'cancelado'))
```
Um bug pode persistir um status inválido que a FSM jamais geraria — mas o banco aceita sem erro.

**Decisão:** Adicionar `CHECK` constraints na migration de criação das tabelas `agendamentos` e `service_slots`.

---

#### 14. Ausência de auditoria em transições de estado

`Agendamento.transitionTo()` e `ServiceSlot.transitionTo()` não registram quem fez a transição, quando, nem qual era o estado anterior. Impossível auditar histórico de mudanças (`cancelado por quem?`).

**Decisão:** Adicionar tabela `agendamento_historico` (ou reaproveitar `historico_alteracoes` já existente em manifestações) com: `agendamento_id`, `status_anterior`, `status_novo`, `usuario_id`, `criado_em`. Preencher em `AgendamentoEfeitosService`.

---

#### 15. `useAgendamentoById` — erro capturado mas não renderizado

```typescript
.catch(e => setError(String(e)))
```

O erro é armazenado em estado mas nenhuma página que usa esse hook renderiza o estado de erro — usuário vê tela em branco ou loading infinito sem feedback.

**Decisão:** Verificar cada consumidor do hook e garantir `if (error) return <ErrorState message={error} />`.

---

### Baixo

#### 16. Notificação via Tauri sem fallback para ambiente não-desktop

`NotificacaoService` faz `import('@tauri-apps/api/core')` dinamicamente. Em ambiente Next.js puro (SSR ou testes), `invoke` não existe — erro é capturado e registrado como `'erro'` no banco, sem notificar operador.

**Decisão:** Documentar que `NotificacaoService` só funciona em contexto Tauri. Alternativa: feature flag por `__TAURI_INTERNALS__` para pular silenciosamente em non-desktop.

---

#### 17. `bairro` obrigatório para `VolumososValidator` mas não forçado no input

`VolumososValidator` lança erro se `bairro` ausente — mas `bairro` vem de `dadosFormulario`, cujo preenchimento depende do template do formulário. Se o template não renderiza o campo `bairro`, o erro só aparece na submissão, não no formulário.

**Decisão:** `CreateBookingUseCase` deve verificar `bairro` antes de chamar validators, ou o `FormRenderer` deve ser configurado para exigir `bairro` quando `validator_key === 'volumosos'`.

---

#### 18. Data retroativa permitida em `UpdateServiceSlotUseCase`

Verifica `status === 'encerrado' || status === 'cancelado'` mas não valida se `dataInicio` é no passado — slot pode ser editado para data retroativa, gerando bookings com data já passada.

**Decisão:** Adicionar guard `if (new Date(input.dataInicio) < new Date()) throw new Error(...)` quando slot ainda está em `rascunho`.

---

## Resumo Executivo

| # | Gap | Severidade | Esforço |
|---|-----|-----------|---------|
| 1 | Race condition na confirmação automática | Crítico | Alto |
| 2 | Sem transação em `CreateBookingUseCase` | Crítico | Médio |
| 3 | Falta de idempotência em `ConfirmarAgendamento` | Crítico | Médio |
| 4 | JSON parse silencioso de `dados_formulario` | Crítico | Baixo |
| 5 | `vagasSolicitadas` sem validação | Alto | Baixo |
| 6 | Catch silencioso em regra de abertura do slot | Alto | Baixo |
| 7 | WhatsApp link com telefone não validado | Alto | Baixo |
| 8 | Comparação de datas por string (não Date) | Alto | Baixo |
| 9 | Sem paginação em `findAll` de slots | Alto | Baixo |
| 10 | `eslint-disable` mascarando bug de dependência | Alto | Baixo |
| 11 | Inconsistência no padrão de atualização de vagas | Médio | Médio |
| 12 | Lógica de negócio em `BookingModal` | Médio | Alto (ADR-038) |
| 13 | Status sem `CHECK` constraint no banco | Médio | Baixo |
| 14 | Ausência de auditoria em transições de estado | Médio | Médio |
| 15 | Erro de hook não renderizado na UI | Médio | Baixo |
| 16 | Notificação Tauri sem fallback | Baixo | Baixo |
| 17 | `bairro` obrigatório sem validação antecipada | Baixo | Médio |
| 18 | Data retroativa permitida em update de slot | Baixo | Baixo |

**Itens 4, 5, 6, 7, 8 são correções de poucas linhas — devem ser feitos imediatamente.**  
**Itens 1, 2, 3 são arquiteturais — requerer spike antes de implementar.**  
**Item 14 (auditoria) deve ser coordenado com a tabela `historico_alteracoes` do módulo manifestações.**

---

## O que está bem (não tocar)

- `ManifestacaoStateMachine` — padrão de FSM correto, replicar para `Agendamento`
- `ServiceSlot.transitionTo()` — guard de transição inválida implementado corretamente
- `CreateBookingUseCase.existeParaClienteESlot()` — verificação de duplicata existe
- `VerificarPrazosVencidosJob` (manifestações) — padrão correto a seguir para job de slots vencidos
- `useAgendamentos.ts` — usa `JSON.stringify(filtros)` como dependência (padrão correto)

---

## Relação com ADRs Existentes

- **ADR-031 (desktop) QueryCatalog:** infrastructure do módulo tem ~20 queries SQL inline em `SqliteAgendamentoRepository` e `SqliteServiceSlotRepository` — incluir em Fase 3 do plano de migração
- **ADR-038 (BookingModal):** gaps 1–4 do ADR-038 (SQL inline, `clienteRepository as any`, sem guard de capacidade, `'anon'` fallback) são pré-condições para corrigir o gap 1 deste ADR (race condition)
- **ADR-039 (Manifestações):** gap 14 (auditoria de transições) deve compartilhar infraestrutura com `historico_alteracoes` já existente em manifestações — não criar tabela duplicada
