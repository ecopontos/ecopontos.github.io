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

Da mesma forma, `GetAgendamentoUseCase` já existe no container mas não é usado em lugar nenhum
da UI — é o que permite buscar telefone/e-mail/endereço/dados do formulário de um agendamento
específico sob demanda.

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

`BookingModal.tsx` é refatorado: remove-se o wrapper `<Dialog><DialogContent>` e o componente
passa a expor apenas o conteúdo (stepper + etapas), recebendo um callback `onClose` como hoje.
Como `BookingModal` só é usado neste único lugar do código, não é necessário manter uma versão
"modal" separada — o componente content-only substitui o atual.

**Largura do Sheet**: `sm:max-w-md` (atual) no modo `detalhes`; `sm:max-w-2xl` no modo
`wizard`, porque o formulário dinâmico do serviço (`FormRenderer`) pode ter muitos campos e
precisa de mais espaço horizontal. A largura volta ao normal ao retornar para `detalhes`.

### 2. Ações por agendamento na lista

Cada item da lista de agendamentos (dentro do modo `detalhes`) ganha um menu de ações
(`DropdownMenu`, ícone "⋮"):

- **Ver detalhes**: expande a linha (`Collapsible`) mostrando telefone, e-mail, bairro,
  endereço e as respostas do formulário (`dadosFormulario`). Os dados são buscados sob
  demanda (na primeira expansão) via `getAgendamentoUseCase.execute(id)`, já registrado no
  container — precisa de um pequeno hook novo (ex.: `useAgendamentoDetail`) ou chamada direta
  via `getContainerAsync()` dentro do componente da linha, com estado de loading/erro local.
- **Reenviar WhatsApp**: chama `findLinkWhatsApp(agendamentoId)` (já existe em
  `useAgendamentoMutations`) e abre o link retornado em nova aba; se não houver link
  disponível, a opção fica desabilitada (mesma checagem já feita na etapa de confirmação do
  wizard).
- **Cancelar agendamento**: só aparece se o status atual permitir transição para `cancelado`
  segundo a máquina de estados do domínio (`pendente` ou `confirmado`; agendamentos
  `realizado`/`cancelado` não mostram essa opção). Ao clicar, abre um `AlertDialog` de
  confirmação; ao confirmar, chama `cancelarAgendamento(agendamentoId)` (já existe, já libera a
  vaga no slot via `CancelarAgendamentoUseCase`).

### 3. Fluxo de dados e correção de bug

**Bug atual**: `AgendamentosPage` guarda `selectedSlot` como um snapshot (setado uma vez no
clique do card). Quando `reload()` de `useServiceSlots` roda após criar um agendamento
(`onBookingCreated` → `reload()`), a lista de slots é atualizada mas `selectedSlot` não é
ressincronizado — a barra de vagas ocupadas dentro do Sheet fica desatualizada até fechar/
reabrir o painel. Isso afetaria igualmente o cancelamento.

**Correção**: em vez de armazenar `selectedSlot` como cópia independente, derivar o slot
exibido a partir do array já carregado: `const selectedSlot = slots.find(s => s.id ===
selectedSlotId) ?? null`. Assim, qualquer `reload()` (criação ou cancelamento) propaga
automaticamente para o Sheet aberto.

**Após cada ação**:
- Criar agendamento → `reloadTasks()` (lista do Sheet) + `reload()` do slot pai (vagas) →
  `modo = 'detalhes'`.
- Cancelar agendamento → mesma coisa: `reloadTasks()` + `reload()` do slot pai.
- Reenviar WhatsApp → nenhuma atualização de estado necessária, só toast/abertura de link.

### 4. Tratamento de erros

- Cancelamento: se o backend rejeitar a transição (ex.: já cancelado por outro dispositivo/
  sessão), mostrar `toast.error` com a mensagem de `CancelarAgendamentoUseCase` e recarregar a
  lista para refletir o estado real.
- Ver detalhes: se `getAgendamentoUseCase` falhar (registro removido/erro de rede), mostrar uma
  mensagem de erro inline na área expandida, sem quebrar a renderização da linha.
- Reenviar WhatsApp: se não houver telefone válido, a opção do menu fica desabilitada
  (mesma regra do wizard atual).

### 5. Testes

- Não há harness de teste de componente (Vitest/RTL) para esta área específica hoje no
  workspace `desktop/`; a validação será manual:
  - Criar um agendamento usando o wizard embutido no Sheet (sem abrir modal central).
  - Cancelar um agendamento existente e confirmar que a vaga volta a aparecer livre tanto no
    Sheet quanto na lista de slots por trás dele.
  - Expandir "Ver detalhes" e conferir telefone/endereço/respostas do formulário.
  - Reenviar WhatsApp e confirmar abertura do link.
  - Confirmar que agendamentos `cancelado`/`realizado` não mostram a opção de cancelar.
- Se houver suíte de testes de hooks no projeto, cobrir a correção do bug de sincronização do
  `selectedSlot` (derivar via `find` em vez de snapshot) com um teste unitário do hook/estado.

## Arquivos afetados (previsão)

- `desktop/app/agendamentos/page.tsx` — `SlotDetailSheet`, `AgendamentosPage` (modos, derivação
  de `selectedSlot`, ações da lista).
- `desktop/components/BookingModal.tsx` — refatorado para componente de conteúdo (sem
  `Dialog`/`DialogContent`).
- `desktop/src/interface/hooks/mutations/useAgendamentoMutations.ts` — sem mudanças de
  contrato; já expõe `cancelarAgendamento` e `findLinkWhatsApp`.
- Novo hook pequeno para detalhe sob demanda (ex.:
  `desktop/src/interface/hooks/queries/useAgendamentoDetail.ts`), usando
  `getAgendamentoUseCase` já registrado no container.
