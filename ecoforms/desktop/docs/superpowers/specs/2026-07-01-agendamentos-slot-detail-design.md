# Design: Painel de Agendamentos por Slot (Relacionamento > Agendamentos)

## Contexto

Em `desktop/app/agendamentos/page.tsx`, ao selecionar um slot na lista/calendário, abre-se
um `Sheet` lateral (`SlotDetailSheet`) com os dados do slot e a lista de agendamentos já
registrados naquele slot (somente leitura: nome + badge de status). O botão "Registrar
agendamento" abre um segundo componente, `BookingModal`, como um `Dialog` centralizado com um
wizard de 3 etapas (cliente → formulário do serviço → confirmação).

Esse fluxo em dois componentes desconectados (painel lateral + modal central) é desconfortável,
e a lista de agendamentos existentes não oferece nenhuma ação — em particular, não há como
cancelar/remover um agendamento pela UI, apesar do caso de uso já existir no backend
(`CancelarAgendamentoUseCase`, exposto via `useAgendamentoMutations().cancelarAgendamento`).

`ListAgendamentosUseCase.execute()` (usado por `useBookingTasks`) já retorna as entidades
`Agendamento` completas — incluindo `clienteTelefone`, `clienteEmail`, `bairro`,
`vagasSolicitadas` e `dadosFormulario` — mas `useBookingTasks.mapAgendamentos` descarta quase
tudo isso ao montar `BookingRow` (só mantém `id`, `titulo`, `status`, `criadoEm`,
`atribuidoPara`). Ou seja, os dados para um "ver detalhes" já estão carregados em memória; não
é necessário nenhum fetch adicional (`GetAgendamentoUseCase`/`useAgendamentoById` não entram
neste design — permanecem como estão, sem uso aqui).

## Objetivo

1. Unificar o fluxo de criação de agendamento dentro do mesmo painel lateral (sem abrir um
   segundo `Dialog` central), reaproveitando a lógica já existente em `BookingModal`.
2. Tornar a lista de agendamentos existentes interativa: permitir cancelar, ver detalhes e
   reenviar o link de WhatsApp por agendamento.
3. Corrigir um bug de sincronização de estado (barra de vagas ocupadas desatualizada após
   criar/cancelar um agendamento).

Fora de escopo: editar dados de um agendamento já criado, marcar agendamento como "realizado"
(a transição existe no domínio mas não será exposta agora), qualquer mudança no fluxo de
`admin/agendamentos` (gestão de slots) ou `modulo/agendamento`.

## Design

### 1. Sheet com dois modos (`detalhes` | `wizard`)

`SlotDetailSheet` (em `desktop/app/agendamentos/page.tsx`) ganha um state local
`modo: 'detalhes' | 'wizard'`.

- **Modo `detalhes`** (padrão ao abrir o Sheet): mantém o conteúdo atual — dados do slot,
  barra de capacidade, botão "Registrar agendamento" (que troca para `modo = 'wizard'`), e a
  lista de agendamentos (agora interativa, ver seção 2).
- **Modo `wizard`**: renderiza dentro do mesmo `<SheetContent>` o conteúdo hoje encapsulado em
  `BookingModal` (etapas cliente → serviço/formulário → confirmação), precedido por um botão
  "← Voltar" que retorna a `modo = 'detalhes'` sem fechar o Sheet. Ao confirmar o agendamento
  (etapa 3, "Fechar"), volta automaticamente a `modo = 'detalhes'`.

**Refactor do `BookingModal.tsx`** (hoje é um único componente com `<Dialog><DialogContent>` em
volta de um wizard de 3 etapas, `components/BookingModal.tsx:145`). Como só é usado neste lugar
(`app/agendamentos/page.tsx`), vira um componente de conteúdo puro, sem `Dialog`:

- Contrato de props: `slotId: string`, `onCancel: () => void`, `onCompleted: (agendamentoId: string) => void`.
  Substitui o atual `onClose(agendamentoId?: string)` — hoje esse único callback é chamado em
  dois pontos com semânticas diferentes (`components/BookingModal.tsx:209`, botão "Cancelar" da
  etapa 1, chama `onClose()` sem id; `components/BookingModal.tsx:288`, botão "Fechar" da etapa
  3, chama `onClose(agendamentoId)`). Separar em `onCancel`/`onCompleted` deixa explícito que
  **ambos** os caminhos devem apenas voltar `modo = 'detalhes'` no Sheet (nenhum dos dois fecha
  o painel inteiro), e que só `onCompleted` deve disparar `reloadTasks()` + `reload()` do slot
  no pai.
- Reset de estado: hoje há um `useEffect` (`components/BookingModal.tsx:53-64`) que reseta
  `etapa`, `selectedCliente`, `prefillData` etc. toda vez que `open` vira `true`. Sem prop
  `open`, a forma mais simples de obter o mesmo efeito é deixar de montar o componente fora do
  modo `wizard` e usar `key={slotId}` no elemento — o unmount/remount natural do React zera o
  estado interno, e o `useEffect` de reset pode ser removido.
- O `Stepper` interno, a busca de cliente (`ClientePhoneSearch`), o `FormRenderer` e a etapa de
  confirmação com link de WhatsApp continuam iguais.

**Largura do Sheet**: `sm:max-w-md` (atual) no modo `detalhes`; `sm:max-w-2xl` no modo
`wizard`, porque o formulário dinâmico do serviço (`FormRenderer`) pode ter muitos campos e
precisa de mais espaço horizontal. A largura volta ao normal ao retornar para `detalhes`.

### 2. Ações por agendamento na lista

**Ampliar `BookingRow`** (`src/interface/hooks/queries/useBookingTasks.ts`) para incluir os
campos que `listAgendamentosUseCase` já retorna e que hoje são descartados: `clienteTelefone`,
`clienteEmail`, `bairro`, `vagasSolicitadas`, `dadosFormulario`. Também tipar `status` como
`StatusAgendamento` (import de `domain/service/Agendamento`) em vez de `string` solto.

Cada item da lista de agendamentos (dentro do modo `detalhes`) ganha um menu de ações
(`DropdownMenu`, ícone "⋮"):

- **Ver detalhes**: expande a linha (`Collapsible`) mostrando telefone, e-mail, bairro e as
  respostas do formulário (`dadosFormulario` — inclui "endereço" apenas quando o formulário do
  serviço tiver esse campo; não é uma propriedade dedicada do domínio). Como esses dados já
  estão em `BookingRow` (ver acima), a expansão é puramente client-side: sem fetch, sem loading,
  sem estado de erro próprio.
- **Reenviar WhatsApp**: chama `findLinkWhatsApp(agendamentoId)` (já existe em
  `useAgendamentoMutations`) e abre o link retornado em nova aba. Não desabilitamos a opção
  preventivamente (checar só `clienteTelefone` não garante que exista link gerado); se a
  chamada retornar `null` ou lançar, mostrar `toast.error` explicando que não há link
  disponível para esse agendamento.
- **Cancelar agendamento**: só aparece se o status atual permitir transição para `cancelado`.
  Em vez de repetir a regra na UI, expor um helper no domínio —
  `Agendamento.podeCancelar(status: StatusAgendamento): boolean` em
  `src/domain/service/Agendamento.ts`, reaproveitando a mesma tabela `TRANSICOES` já usada por
  `podeTransitarPara` — e usá-lo tanto para decidir se o item do menu aparece quanto (defensivamente)
  antes de disparar a mutation. Ao clicar, abre um `AlertDialog` de confirmação; ao confirmar,
  chama `cancelarAgendamento(agendamentoId)` (já existe, já libera a vaga no slot via
  `CancelarAgendamentoUseCase`).

**Estado por linha**: para evitar cliques duplicados e concorrência entre ações, `SlotDetailSheet`
mantém estado explícito: `expandedId: string | null` (linha com detalhes abertos),
`actionInFlightId: string | null` (linha com cancelamento/reenvio em andamento — desabilita os
botões daquela linha enquanto pendente) e `cancelTarget: string | null` (id aguardando
confirmação no `AlertDialog`).

### 3. Fluxo de dados e correção de bug

**Bug atual**: `AgendamentosPage` guarda `selectedSlot` como um snapshot (setado uma vez no
clique do card). Quando `reload()` de `useServiceSlots` roda após criar um agendamento
(`onBookingCreated` → `reload()`), a lista de slots é atualizada mas `selectedSlot` não é
ressincronizado — a barra de vagas ocupadas dentro do Sheet fica desatualizada até fechar/
reabrir o painel. Isso afetaria igualmente o cancelamento.

**Correção**: `AgendamentosPage` já guarda `selectedSlotId` (implícito no clique do card) — a
mudança é parar de guardar o objeto `selectedSlot` e passar a derivá-lo a cada render:
`const selectedSlot = slots.find(s => s.id === selectedSlotId) ?? null`. Assim, qualquer
`reload()` (criação ou cancelamento) propaga automaticamente para o Sheet aberto.

Caso especial: como a página só carrega slots com `status: 'publicado'`, se uma ação fizer o
slot sair dessa lista (ex.: encerrado/lotado e removido do filtro por outra tela) o `find`
retorna `undefined` depois do reload. Nesse caso, `selectedSlot` vira `null` e o Sheet deve
fechar automaticamente (`sheetOpen = false`) com um `toast` informando que o slot não está mais
disponível, em vez de renderizar um painel com `slot` nulo.

**Após cada ação**:
- Criar agendamento → `onCompleted(agendamentoId)` dispara `reloadTasks()` (lista do Sheet) +
  `reload()` do slot pai (vagas) → `modo = 'detalhes'`.
- Cancelar agendamento → mesma coisa: `reloadTasks()` + `reload()` do slot pai.
- Reenviar WhatsApp → nenhuma atualização de estado necessária, só toast/abertura de link.

### 4. Tratamento de erros

- **Lista de agendamentos**: `useBookingTasks` já expõe `error` (`useBookingTasks.ts:19`), mas o
  Sheet hoje o ignora silenciosamente. Passa a exibir esse erro (mensagem + botão "Tentar
  novamente" chamando `reload`) no lugar da lista quando presente.
- **Cancelamento**: se o backend rejeitar a transição (ex.: já cancelado por outro dispositivo/
  sessão), mostrar `toast.error` com a mensagem de `CancelarAgendamentoUseCase` e chamar
  `reloadTasks()` de qualquer forma, para refletir o estado real (o item deixa de mostrar a
  opção "Cancelar" assim que `podeCancelar` for reavaliado com o status atualizado).
- **Ver detalhes**: sem estado de erro próprio (dado já carregado — ver seção 2).
- **Reenviar WhatsApp**: ver seção 2 (toast reativo em vez de desabilitar preventivamente).

### 5. Testes

O workspace `desktop/` já tem Vitest + Testing Library + Playwright configurados
(`package.json`) e um padrão estabelecido de teste de componente que mocka hooks de dados via
`vi.mock` e usa `render`/`waitFor` do RTL (ver
`src/interface/tasks/__tests__/TaskDetailPage.test.tsx`). Seguir o mesmo padrão:

- **Unitário (domínio)**: `Agendamento.podeCancelar` — cobre as 4 combinações de status
  (`pendente`/`confirmado` → `true`; `realizado`/`cancelado` → `false`).
- **Componente (RTL)**, novo arquivo próximo a `app/agendamentos/`, mockando
  `useServiceSlots`, `useBookingTasks`, `useAgendamentoMutations`:
  - Selecionar um slot abre o Sheet em modo `detalhes` com a lista de agendamentos.
  - Clicar "Registrar agendamento" troca para modo `wizard` sem desmontar o Sheet; "← Voltar"/
    "Cancelar" (etapa 1) retorna a `detalhes` sem fechar o painel.
  - Clicar "Cancelar agendamento" abre o `AlertDialog`; confirmar chama
    `cancelarAgendamento` e recarrega a lista; item em status `cancelado`/`realizado` não
    mostra a opção.
  - "Ver detalhes" expande a linha mostrando os campos de `dadosFormulario` sem novas chamadas
    ao container (assert de que o mock de `getContainerAsync`/`getAgendamentoUseCase` não é
    chamado).
  - `selectedSlot` deriva corretamente de `slots` após um `reload()` simulado (vagas
    atualizadas no painel já aberto), e o Sheet fecha com toast se o slot sumir da lista.
- Validação manual complementar (fluxo real com Tauri/SQLite): criar agendamento pelo wizard
  embutido, cancelar e conferir que a vaga volta a aparecer livre no slot, reenviar WhatsApp.

## Arquivos afetados (previsão)

- `desktop/app/agendamentos/page.tsx` — `SlotDetailSheet`, `AgendamentosPage` (modos, derivação
  de `selectedSlot`, estado por linha, ações da lista).
- `desktop/components/BookingModal.tsx` — refatorado para componente de conteúdo (sem
  `Dialog`/`DialogContent`), props `onCancel`/`onCompleted` no lugar de `onClose`.
- `desktop/src/domain/service/Agendamento.ts` — novo helper `podeCancelar(status)`.
- `desktop/src/interface/hooks/queries/useBookingTasks.ts` — `BookingRow` ampliado
  (`clienteTelefone`, `clienteEmail`, `bairro`, `vagasSolicitadas`, `dadosFormulario`,
  `status: StatusAgendamento`).
- `desktop/src/interface/hooks/mutations/useAgendamentoMutations.ts` — sem mudanças de
  contrato; já expõe `cancelarAgendamento` e `findLinkWhatsApp`.
- **Fora de escopo / não tocados**: `useAgendamentoById.ts` e `GetAgendamentoUseCase` (não são
  necessários — ver seção "Contexto").
