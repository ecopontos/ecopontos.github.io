# Painel de Agendamentos por Slot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar o wizard de criação de agendamento dentro do painel lateral (`Sheet`) de `desktop/app/agendamentos/page.tsx`, e tornar a lista de agendamentos existentes interativa (ver detalhes, reenviar WhatsApp, cancelar).

**Architecture:** Sem novas dependências ou infraestrutura. Reaproveita casos de uso já existentes no container (`cancelarAgendamentoUseCase`, `listAgendamentosUseCase`). O `Sheet` ganha um modo `wizard` que substitui o antigo `Dialog` central; cada agendamento da lista vira um componente próprio (`AgendamentoRow`) com botões inline (não `DropdownMenu` — ver Nota de Implementação abaixo) que controlam um `Collapsible` (detalhes) e um `AlertDialog` (confirmação de cancelamento).

**Tech Stack:** Next.js App Router, React, TypeScript, Radix UI (via `components/ui/*`), Tauri/SQLite (Clean Architecture já existente), Vitest + Testing Library.

## Nota de Implementação (desvio deliberado do spec)

O spec (`docs/superpowers/specs/2026-07-01-agendamentos-slot-detail-design.md`) descreve as ações por
agendamento como um menu (`DropdownMenu`). Ao preparar este plano, validei empiricamente neste
workspace (`npx vitest run` contra probes descartáveis) que:

- `fireEvent.click` **não** abre `DropdownMenu` do Radix neste ambiente (happy-dom, sem
  `@testing-library/user-event`, sem polyfills de `hasPointerCapture`) — o trigger fica preso em
  `data-state="closed"`. Não há nenhum uso de `DropdownMenu` em `app/` hoje (grep confirmou), então
  não existe precedente resolvendo isso no repo.
- `Collapsible` e `AlertDialog` **funcionam normalmente** com `fireEvent.click`, inclusive na
  composição exata que este plano usa (`CollapsibleTrigger asChild` com `Button`; `AlertDialog`
  controlado externamente por um `useState` local, sem `AlertDialogTrigger`).
- `app/clientes/[id]/ClienteDetailPage.tsx` já usa exatamente esse padrão (botões de ícone inline +
  `AlertDialog` controlado por um `useState` de "target") para ações destrutivas (desvincular).

Por isso, este plano troca o `DropdownMenu` por **botões inline** por linha (mesmo padrão de
`ClienteDetailPage.tsx`), o que: (a) é testável automaticamente sem adicionar dependências novas,
(b) seque um padrão já estabelecido no código, (c) preserva a intenção do spec (as mesmas 3 ações
por agendamento, com confirmação antes de cancelar).

Segundo desvio, menor: o spec descreve o estado por linha (`expandedId`, `actionInFlightId`,
`cancelTarget`) como centralizado em `SlotDetailSheet`. Como cada `AgendamentoRow` (Task 4) já é um
componente próprio e independente, esse estado fica local a cada instância (`useState` dentro do
próprio `AgendamentoRow`) em vez de um mapa por id no componente pai — mesmo efeito (evita cliques
duplicados, confirmação antes de cancelar), com um componente mais simples de testar isoladamente.

## Global Constraints

- Strings de UI em português, consistente com o resto do app.
- Sem novas dependências de npm (nem `@testing-library/user-event`, nem `@radix-ui/*` adicionais).
- Arquivos de teste **devem** ficar sob `src/**/*.test.{ts,tsx}` — é o único padrão que
  `desktop/vitest.config.ts` inclui (`include: ['src/**/*.test.{ts,tsx}']`). Componentes que vivem
  fisicamente em `app/` ou `components/` têm seus testes colocados em `src/interface/agendamentos/__tests__/`,
  espelhando o precedente de `src/interface/tasks/__tests__/TaskDetailPage.test.tsx`.
- Seguir o padrão de mock já usado no repo: `vi.mock('../utils/useContainer', () => ({ getContainerAsync: vi.fn() }))`
  para hooks, e `vi.mock('@/caminho/do/modulo', () => ({ ... }))` para componentes/dependências pesadas
  (padrão de `TaskDetailPage.test.tsx` e `useSeedDemo.test.tsx`).
- Rodar testes a partir de `desktop/`: `npx vitest run <caminho>` (equivalente a `npm run test -- <caminho>`).
- Commits em português, sem `--no-verify`.

---

### Task 1: Domínio — `podeCancelarAgendamento`

**Files:**
- Modify: `desktop/src/domain/service/Agendamento.ts:1-8`
- Test: `desktop/src/domain/service/__tests__/Agendamento.test.ts` (novo)

**Interfaces:**
- Produces: `podeCancelarAgendamento(status: StatusAgendamento): boolean`, exportado de
  `desktop/src/domain/service/Agendamento.ts`. Tarefas seguintes (`AgendamentoRow`, Task 4) importam
  este símbolo.

- [ ] **Step 1: Escrever o teste que falha**

Criar `desktop/src/domain/service/__tests__/Agendamento.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { podeCancelarAgendamento } from '../Agendamento';

describe('podeCancelarAgendamento', () => {
    it('permite cancelar quando pendente', () => {
        expect(podeCancelarAgendamento('pendente')).toBe(true);
    });

    it('permite cancelar quando confirmado', () => {
        expect(podeCancelarAgendamento('confirmado')).toBe(true);
    });

    it('nao permite cancelar quando realizado', () => {
        expect(podeCancelarAgendamento('realizado')).toBe(false);
    });

    it('nao permite cancelar quando ja cancelado', () => {
        expect(podeCancelarAgendamento('cancelado')).toBe(false);
    });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run (a partir de `desktop/`): `npx vitest run src/domain/service/__tests__/Agendamento.test.ts`
Expected: FAIL — `podeCancelarAgendamento` não existe em `../Agendamento` (erro de import/undefined).

- [ ] **Step 3: Implementar**

Em `desktop/src/domain/service/Agendamento.ts`, o arquivo hoje começa assim:

```ts
export type StatusAgendamento = 'pendente' | 'confirmado' | 'realizado' | 'cancelado';

const TRANSICOES: Record<StatusAgendamento, StatusAgendamento[]> = {
    pendente:   ['confirmado', 'cancelado'],
    confirmado: ['realizado', 'cancelado'],
    realizado:  [],
    cancelado:  [],
};
```

Adicionar logo depois do bloco `TRANSICOES` (antes de `export interface AgendamentoProps`):

```ts
export function podeCancelarAgendamento(status: StatusAgendamento): boolean {
    return TRANSICOES[status]?.includes('cancelado') ?? false;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domain/service/__tests__/Agendamento.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/service/Agendamento.ts src/domain/service/__tests__/Agendamento.test.ts
git commit -m "feat(agendamentos): adiciona podeCancelarAgendamento ao dominio"
```

---

### Task 2: Hook — ampliar `BookingRow` em `useBookingTasks`

**Files:**
- Modify: `desktop/src/interface/hooks/queries/useBookingTasks.ts` (arquivo inteiro, 86 linhas)
- Test: `desktop/src/interface/hooks/queries/__tests__/useBookingTasks.test.ts` (novo)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `BookingRow` ganha os campos `clienteTelefone: string | null`, `clienteEmail: string | null`,
  `bairro: string | null`, `vagasSolicitadas: number`, `dadosFormulario: Record<string, unknown>`, e
  `status` passa a ser tipado como `StatusAgendamento` (era `string`). `useBookingTasks(slotId)` continua
  retornando `{ tasks, loading, error, hasMore, loadMore, reload }`. Task 4 (`AgendamentoRow`) e Task 5
  (`app/agendamentos/page.tsx`) consomem `BookingRow` com esse formato ampliado.

- [ ] **Step 1: Escrever o teste que falha**

Criar `desktop/src/interface/hooks/queries/__tests__/useBookingTasks.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBookingTasks } from '../useBookingTasks';
import { getContainerAsync } from '../../utils/useContainer';

vi.mock('../../utils/useContainer', () => ({
    getContainerAsync: vi.fn(),
}));

describe('useBookingTasks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mapeia telefone, email, bairro, vagas e dados do formulario', async () => {
        const execute = vi.fn().mockResolvedValue([
            {
                id: 'ag-1',
                clienteNome: 'Maria Souza',
                status: 'confirmado',
                criadoEm: '2026-06-01T10:00:00.000Z',
                responsavelId: null,
                clienteTelefone: '11999999999',
                clienteEmail: 'maria@example.com',
                bairro: 'Centro',
                vagasSolicitadas: 2,
                dadosFormulario: { endereco: 'Rua das Flores, 123' },
            },
        ]);
        vi.mocked(getContainerAsync).mockResolvedValue({
            listAgendamentosUseCase: { execute },
        } as never);

        const { result } = renderHook(() => useBookingTasks('slot-1'));

        await waitFor(() => {
            expect(result.current.tasks).toHaveLength(1);
        });

        expect(result.current.tasks[0]).toEqual({
            id: 'ag-1',
            titulo: 'Maria Souza',
            status: 'confirmado',
            criadoEm: '2026-06-01T10:00:00.000Z',
            atribuidoPara: null,
            clienteTelefone: '11999999999',
            clienteEmail: 'maria@example.com',
            bairro: 'Centro',
            vagasSolicitadas: 2,
            dadosFormulario: { endereco: 'Rua das Flores, 123' },
        });
        expect(execute).toHaveBeenCalledWith({ slotId: 'slot-1', limit: 26, offset: 0 });
    });

    it('usa null para campos opcionais ausentes', async () => {
        const execute = vi.fn().mockResolvedValue([
            {
                id: 'ag-2',
                clienteNome: 'Joao',
                status: 'pendente',
                criadoEm: '2026-06-02T10:00:00.000Z',
                vagasSolicitadas: 1,
                dadosFormulario: {},
            },
        ]);
        vi.mocked(getContainerAsync).mockResolvedValue({
            listAgendamentosUseCase: { execute },
        } as never);

        const { result } = renderHook(() => useBookingTasks('slot-1'));

        await waitFor(() => {
            expect(result.current.tasks).toHaveLength(1);
        });

        expect(result.current.tasks[0].clienteTelefone).toBeNull();
        expect(result.current.tasks[0].clienteEmail).toBeNull();
        expect(result.current.tasks[0].bairro).toBeNull();
        expect(result.current.tasks[0].atribuidoPara).toBeNull();
    });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/interface/hooks/queries/__tests__/useBookingTasks.test.ts`
Expected: FAIL — o primeiro `expect(...).toEqual(...)` não bate porque `BookingRow` hoje só tem
`id/titulo/status/criadoEm/atribuidoPara`.

- [ ] **Step 3: Implementar**

Substituir o conteúdo inteiro de `desktop/src/interface/hooks/queries/useBookingTasks.ts` por:

```ts
"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from "react";
import { getContainerAsync } from "../utils/useContainer";
import type { StatusAgendamento } from "@/src/domain/service/Agendamento";

const PAGE_SIZE = 25;

export interface BookingRow {
    id: string;
    titulo: string;
    status: StatusAgendamento;
    criadoEm: string;
    atribuidoPara: string | null;
    clienteTelefone: string | null;
    clienteEmail: string | null;
    bairro: string | null;
    vagasSolicitadas: number;
    dadosFormulario: Record<string, unknown>;
}

export function useBookingTasks(slotId: string | null) {
    const [tasks, setTasks] = useState<BookingRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const offsetRef = useRef(0);

    const mapAgendamentos = (agendamentos: {
        id: string;
        clienteNome: string;
        status: StatusAgendamento;
        criadoEm: string;
        responsavelId?: string | null;
        clienteTelefone?: string | null;
        clienteEmail?: string | null;
        bairro?: string | null;
        vagasSolicitadas: number;
        dadosFormulario: Record<string, unknown>;
    }[]): BookingRow[] =>
        agendamentos.map(a => ({
            id:               a.id,
            titulo:           a.clienteNome,
            status:           a.status,
            criadoEm:         a.criadoEm,
            atribuidoPara:    a.responsavelId ?? null,
            clienteTelefone:  a.clienteTelefone ?? null,
            clienteEmail:     a.clienteEmail ?? null,
            bairro:           a.bairro ?? null,
            vagasSolicitadas: a.vagasSolicitadas,
            dadosFormulario:  a.dadosFormulario,
        }));

    const reload = useCallback(async () => {
        if (!slotId) { setTasks([]); setHasMore(false); return; }
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
        try {
            const container = await getContainerAsync();
            const agendamentos = await container.listAgendamentosUseCase.execute({
                slotId,
                limit: PAGE_SIZE + 1,
                offset: 0,
            });
            const more = agendamentos.length > PAGE_SIZE;
            const page = more ? agendamentos.slice(0, PAGE_SIZE) : agendamentos;
            setTasks(mapAgendamentos(page));
            setHasMore(more);
            offsetRef.current = page.length;
        } catch (e) {
            setError(String(e));
            setTasks([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [slotId]);

    const loadMore = useCallback(async () => {
        if (!slotId || loading || !hasMore) return;
        setLoading(true);
        try {
            const container = await getContainerAsync();
            const agendamentos = await container.listAgendamentosUseCase.execute({
                slotId,
                limit: PAGE_SIZE + 1,
                offset: offsetRef.current,
            });
            const more = agendamentos.length > PAGE_SIZE;
            const page = more ? agendamentos.slice(0, PAGE_SIZE) : agendamentos;
            setTasks(prev => [...prev, ...mapAgendamentos(page)]);
            setHasMore(more);
            offsetRef.current += page.length;
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, [slotId, loading, hasMore]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { tasks, loading, error, hasMore, loadMore, reload };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/interface/hooks/queries/__tests__/useBookingTasks.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/interface/hooks/queries/useBookingTasks.ts src/interface/hooks/queries/__tests__/useBookingTasks.test.ts
git commit -m "feat(agendamentos): amplia BookingRow com telefone, email, bairro e dados do formulario"
```

---

### Task 3: Refatorar `BookingModal` → `BookingWizardContent`

**Files:**
- Create (via `git mv`): `desktop/components/BookingWizardContent.tsx`
- Delete: `desktop/components/BookingModal.tsx`
- Test: `desktop/src/interface/agendamentos/__tests__/BookingWizardContent.test.tsx` (novo)

**Interfaces:**
- Consumes: nenhuma interface de tasks anteriores.
- Produces: `BookingWizardContent({ slotId: string; onCancel: () => void; onCompleted: (agendamentoId: string) => void })`
  — substitui `BookingModal({ slotId, open, onClose })`. Task 5 (`app/agendamentos/page.tsx`) usa este
  componente embutido no `Sheet`, sem `open` e sem `Dialog` ao redor.

**Nota — reset de estado sem `useEffect`:** o `BookingModal` original tinha um `useEffect(() => { if
(open) { ...reset de 8 campos... } }, [open, slotId])` que zerava `etapa`, `selectedCliente`,
`responsavelId`, `prefillData`, `enderecoDiferente`, `agendamentoId`, `waLink` e `showQuickCreate`
toda vez que o Dialog reabria. Esse `useEffect` é removido neste refactor e **não** é substituído por
outro — o reset passa a acontecer via mount/unmount: `BookingWizardContent` só existe na árvore
enquanto `modo === 'wizard'` (Task 5), então cada vez que o Sheet volta para esse modo o componente é
desmontado e remontado do zero, e os `useState(...)` iniciais já fazem o reset dos 8 campos
automaticamente (mais robusto que o reset manual, que dependia de listar cada campo). O único caminho
que **não** passa por unmount é `reiniciar()` (clique em "Novo agendamento no mesmo slot" na etapa 3,
que volta para a etapa 1 sem desmontar o componente) — essa função já existia no `BookingModal`
original e já não reseta `showQuickCreate`. Não é uma regressão: `reiniciar()` só é alcançável depois
de já ter selecionado um cliente (a etapa 2 exige `selectedCliente`), e selecionar um cliente sempre
zera `showQuickCreate` antes disso (via `onCreated`/`onCancel` do `QuickCreateClientForm`) — ou seja,
`showQuickCreate` já está `false` em todo caminho que chega a `reiniciar()`, no código antigo e no
novo. Não é necessário adicionar `setShowQuickCreate(false)` a `reiniciar()`.

- [ ] **Step 1: Renomear o arquivo preservando histórico**

```bash
git mv components/BookingModal.tsx components/BookingWizardContent.tsx
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `desktop/src/interface/agendamentos/__tests__/BookingWizardContent.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingWizardContent } from '@/components/BookingWizardContent';

vi.mock('@/components/clientes/ClientePhoneSearch', () => ({
    ClientePhoneSearch: () => <div data-testid="cliente-phone-search" />,
}));
vi.mock('@/components/clientes/QuickCreateClientForm', () => ({
    QuickCreateClientForm: () => <div data-testid="quick-create-client" />,
}));
vi.mock('@/components/runtime/FormRenderer', () => ({
    FormRenderer: () => <div data-testid="form-renderer" />,
}));
vi.mock('@/src/interface/hooks/catalog/forms', () => ({
    useFormTemplate: () => ({ template: null, loading: false }),
}));
vi.mock('@/src/interface/hooks/catalog/service', () => ({
    useServiceSlotById: () => ({
        slot: {
            id: 'slot-1',
            titulo: 'Coleta Bairro Centro',
            dataInicio: '2026-07-10',
            dataFim: '2026-07-10',
            capacidade: 10,
            vagasOcupadas: 3,
            serviceTypeId: 'tipo-1',
        },
        loading: false,
    }),
    useServiceTypes: () => ({
        types: [{ id: 'tipo-1', nome: 'Coleta de óleo', icone: '🛢️', formId: null }],
    }),
    useAgendamentoMutations: () => ({
        criarBooking: vi.fn(),
        findLinkWhatsApp: vi.fn(),
        loading: false,
        error: null,
    }),
}));
vi.mock('@/src/interface/hooks/catalog/auth', () => ({
    useAdminUsers: () => ({ users: [] }),
    useAuth: () => ({ user: { id: 'user-1' } }),
}));

describe('BookingWizardContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('chama onCancel ao clicar em Cancelar na etapa 1', () => {
        const onCancel = vi.fn();
        render(<BookingWizardContent slotId="slot-1" onCancel={onCancel} onCompleted={vi.fn()} />);

        fireEvent.click(screen.getByText('Cancelar'));

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('renderiza o nome do slot e do tipo de servico', () => {
        render(<BookingWizardContent slotId="slot-1" onCancel={vi.fn()} onCompleted={vi.fn()} />);

        expect(screen.getByText('Coleta de óleo')).toBeTruthy();
        expect(screen.getByText('Coleta Bairro Centro', { exact: false })).toBeTruthy();
    });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/interface/agendamentos/__tests__/BookingWizardContent.test.tsx`
Expected: FAIL — `@/components/BookingWizardContent` não existe ainda (só o conteúdo renomeado do
arquivo antigo, que ainda exporta `BookingModal` com props antigas).

- [ ] **Step 4: Implementar — substituir todo o conteúdo de `components/BookingWizardContent.tsx`**

```tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, UserPlus, CheckCircle, MessageCircle, ExternalLink } from "lucide-react";
import { ClientePhoneSearch, type SelectedCliente } from "@/components/clientes/ClientePhoneSearch";
import { QuickCreateClientForm } from "@/components/clientes/QuickCreateClientForm";
import { FormRenderer } from "@/components/runtime/FormRenderer";
import { useFormTemplate } from "@/src/interface/hooks/catalog/forms";
import { useServiceSlotById } from "@/src/interface/hooks/catalog/service";
import { useServiceTypes } from "@/src/interface/hooks/catalog/service";
import { useAgendamentoMutations } from "@/src/interface/hooks/catalog/service";
import { useAdminUsers } from "@/src/interface/hooks/catalog/auth";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import type { FormFieldValue } from "@/components/runtime/FormFieldRenderer";
import type { FormContent } from "@/types";
import { formatDateBR } from "@/src/lib/date";
import { toast } from "sonner";

interface BookingWizardContentProps {
    slotId: string;
    onCancel: () => void;
    onCompleted: (agendamentoId: string) => void;
}

type Etapa = 1 | 2 | 3;

export function BookingWizardContent({ slotId, onCancel, onCompleted }: BookingWizardContentProps) {
    const { user } = useAuth();
    const { slot, loading: slotLoading } = useServiceSlotById(slotId || null);
    const { types } = useServiceTypes();
    const serviceType = types.find(t => t.id === slot?.serviceTypeId);
    const { template, loading: formLoading } = useFormTemplate(serviceType?.formId ?? undefined);
    const { criarBooking, findLinkWhatsApp, loading: bookingLoading, error: bookingError } = useAgendamentoMutations();
    const { users } = useAdminUsers();

    const usuarios = users.filter(u => u.ativo).map(u => ({ id: u.id, nome: u.nome }));

    const [etapa, setEtapa] = useState<Etapa>(1);
    const [selectedCliente, setSelectedCliente] = useState<SelectedCliente | null>(null);
    const [responsavelId, setResponsavelId] = useState("");
    const [prefillData, setPrefillData] = useState<Record<string, FormFieldValue>>({});
    const [enderecoDiferente, setEnderecoDiferente] = useState(false);
    const [agendamentoId, setAgendamentoId] = useState<string | null>(null);
    const [waLink, setWaLink] = useState<string | null>(null);
    const [showQuickCreate, setShowQuickCreate] = useState(false);

    const handleSelectCliente = (cliente: SelectedCliente | null) => {
        setSelectedCliente(cliente);
        setEnderecoDiferente(false);
        if (cliente) {
            setPrefillData({
                cliente_id:   cliente.id,
                cliente_nome: cliente.nome,
                telefone:     cliente.telefone ?? '',
                email:        cliente.email ?? '',
                bairro:       cliente.bairro ?? '',
                endereco:     buildEnderecoCompleto(cliente),
                cidade:       cliente.cidade ?? '',
                cep:          cliente.cep ?? '',
            });
        } else {
            setPrefillData({});
        }
    };

    const handleEnderecoDiferenteChange = (checked: boolean) => {
        setEnderecoDiferente(checked);
        setPrefillData(prev => {
            if (checked && selectedCliente) {
                const { endereco: _, cidade: __, cep: ___, ...rest } = prev;
                return rest;
            }
            if (!checked && selectedCliente) {
                return {
                    ...prev,
                    endereco: buildEnderecoCompleto(selectedCliente),
                    cidade: selectedCliente.cidade ?? '',
                    cep: selectedCliente.cep ?? '',
                    bairro: selectedCliente.bairro ?? '',
                };
            }
            return prev;
        });
    };

    const handleFormSubmit = async (dados: Record<string, FormFieldValue>) => {
        if (!slot || !user || !selectedCliente) return;
        if (slot.capacidade && slot.vagasOcupadas >= slot.capacidade) {
            toast.error("Slot lotado. Selecione outro horário.");
            return;
        }
        const id = await criarBooking({
            slotId: slot.id,
            clienteId:       selectedCliente.id,
            clienteNome:     selectedCliente.nome ?? (dados.cliente_nome as string) ?? 'Cliente',
            clienteEmail:    selectedCliente.email ?? (dados.email as string) ?? undefined,
            clienteTelefone: selectedCliente.telefone ?? (dados.telefone as string) ?? undefined,
            dadosFormulario: dados,
            vagasSolicitadas: (dados.vagas_solicitadas as number) ?? 1,
            bairro:           (dados.bairro as string) ?? undefined,
            responsavelId:    responsavelId || undefined,
            userId:           user.id,
        });
        setAgendamentoId(id);
        try {
            const link = await findLinkWhatsApp(id);
            setWaLink(link);
        } catch { /* sem notificação — ok */ }
        setEtapa(3);
    };

    const reiniciar = () => {
        setEtapa(1);
        setSelectedCliente(null);
        setResponsavelId("");
        setPrefillData({});
        setEnderecoDiferente(false);
        setAgendamentoId(null);
        setWaLink(null);
    };

    const isLoading = slotLoading || formLoading;
    const dataFormatada = slot ? formatDateBR(slot.dataInicio) : '';

    return (
        <div className="space-y-4 pt-2">
            {slot && serviceType && (
                <div>
                    <p className="flex items-center gap-2 text-base font-semibold">
                        <span>{serviceType.icone ?? '📅'}</span>
                        <span>{serviceType.nome}</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span className="text-muted-foreground font-normal text-sm">{slot.titulo} · {dataFormatada}</span>
                    </p>
                    {slot.capacidade && (
                        <CapacidadeBadge ocupadas={slot.vagasOcupadas} total={slot.capacidade} />
                    )}
                </div>
            )}

            {isLoading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {!isLoading && (!slot || !serviceType) && (
                <p className="text-center text-red-500 py-8">Slot ou tipo de serviço não encontrado.</p>
            )}

            {!isLoading && slot && serviceType && (
                <>
                    <Stepper etapa={etapa} />

                    {etapa === 1 && (
                        <div className="space-y-4 pt-2">
                            <ClientePhoneSearch selected={selectedCliente} onSelect={handleSelectCliente} />
                            {!selectedCliente && !showQuickCreate && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground">Cliente não encontrado?</span>
                                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowQuickCreate(true)}>
                                        <UserPlus className="mr-1 h-3 w-3" />
                                        Cadastrar novo cliente
                                    </Button>
                                </div>
                            )}
                            {!selectedCliente && showQuickCreate && (
                                <QuickCreateClientForm
                                    onCreated={(cliente) => {
                                        handleSelectCliente(cliente);
                                        setShowQuickCreate(false);
                                    }}
                                    onCancel={() => setShowQuickCreate(false)}
                                />
                            )}
                            {selectedCliente && (
                                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
                                    <Checkbox
                                        id="endereco-diferente"
                                        checked={enderecoDiferente}
                                        onCheckedChange={(v) => handleEnderecoDiferenteChange(v === true)}
                                    />
                                    <Label htmlFor="endereco-diferente" className="text-sm cursor-pointer">
                                        Endereço de coleta diferente do cadastro
                                    </Label>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                                <Button onClick={() => setEtapa(2)} disabled={!selectedCliente}>
                                    Próximo →
                                </Button>
                            </div>
                        </div>
                    )}

                    {etapa === 2 && (
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Responsável pela execução
                                </Label>
                                <Select value={responsavelId} onValueChange={setResponsavelId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecionar (opcional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {usuarios.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {template && serviceType.formId ? (
                                <FormRenderer
                                    content={template as FormContent}
                                    formType={serviceType.formId}
                                    prefillData={prefillData}
                                    customSubmit={handleFormSubmit}
                                    submitLabel={bookingLoading ? "Confirmando..." : "Confirmar agendamento →"}
                                />
                            ) : (
                                <p className="text-muted-foreground text-sm">
                                    Este tipo de serviço não possui formulário configurado.
                                </p>
                            )}

                            {bookingError && (
                                <p className="text-sm text-red-500">{bookingError}</p>
                            )}

                            <Button variant="ghost" onClick={() => setEtapa(1)} disabled={bookingLoading}>
                                ← Voltar
                            </Button>
                        </div>
                    )}

                    {etapa === 3 && agendamentoId && (
                        <div className="space-y-4 pt-2 text-center">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                            <div>
                                <p className="font-semibold text-lg">Agendamento confirmado!</p>
                                <p className="text-sm text-muted-foreground font-mono mt-1">
                                    Protocolo: {agendamentoId}
                                </p>
                            </div>
                            <div className="text-sm space-y-1 text-muted-foreground">
                                <p><strong>Cliente:</strong> {selectedCliente?.nome}</p>
                                <p><strong>Serviço:</strong> {serviceType.nome} · {slot.titulo}</p>
                                <p><strong>Data:</strong> {dataFormatada}</p>
                            </div>

                            <div className="flex justify-center gap-3 pt-2 flex-wrap">
                                {waLink && (
                                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm">
                                            <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                                            Enviar WhatsApp
                                            <ExternalLink className="ml-1 h-3 w-3" />
                                        </Button>
                                    </a>
                                )}
                                <Button variant="outline" size="sm" onClick={reiniciar}>
                                    Novo agendamento no mesmo slot
                                </Button>
                                <Button size="sm" onClick={() => onCompleted(agendamentoId)}>
                                    Fechar
                                </Button>
                            </div>
                        </div>
                    )}
                    {etapa === 3 && !agendamentoId && (
                        <div className="space-y-4 pt-2 text-center">
                            <p className="text-red-500 py-4">Erro ao confirmar agendamento. Tente novamente.</p>
                            <Button variant="outline" onClick={reiniciar}>Tentar novamente</Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Stepper({ etapa }: { etapa: Etapa }) {
    const steps = ['① Cliente', '② Serviço', '③ Confirmação'];
    return (
        <div className="flex items-center gap-4 text-sm py-1">
            {steps.map((s, i) => (
                <span
                    key={i}
                    className={i + 1 === etapa ? 'font-semibold text-primary' : i + 1 < etapa ? 'text-muted-foreground line-through' : 'text-muted-foreground'}
                >
                    {s}
                </span>
            ))}
        </div>
    );
}

function CapacidadeBadge({ ocupadas, total }: { ocupadas: number; total: number }) {
    const pct = total > 0 ? ocupadas / total : 0;
    const livres = total - ocupadas;
    const variant = pct >= 1 ? 'secondary' : pct >= 0.85 ? 'destructive' : 'outline';
    return (
        <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                <div
                    className={`h-full rounded-full transition-all ${pct >= 1 ? 'bg-muted-foreground' : pct >= 0.85 ? 'bg-red-500' : pct >= 0.6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, pct * 100)}%` }}
                />
            </div>
            <Badge variant={variant} className="text-xs">
                {pct >= 1 ? 'Lotado' : `${livres} vaga${livres !== 1 ? 's' : ''}`}
            </Badge>
        </div>
    );
}

function buildEnderecoCompleto(cliente: SelectedCliente): string {
    const parts: string[] = [];
    if (cliente.endereco) parts.push(cliente.endereco);
    if (cliente.numero) parts.push(cliente.numero);
    const ruaNumero = parts.join(', ');
    const resto: string[] = [];
    if (cliente.complemento) resto.push(cliente.complemento);
    if (cliente.bairro) resto.push(cliente.bairro);
    const cidadeEstado = [cliente.cidade, cliente.estado].filter(Boolean).join('/');
    if (cidadeEstado) resto.push(cidadeEstado);
    if (cliente.cep) resto.push(`CEP: ${cliente.cep}`);
    return [ruaNumero, ...resto].filter(Boolean).join(' - ');
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/interface/agendamentos/__tests__/BookingWizardContent.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add components/BookingWizardContent.tsx src/interface/agendamentos/__tests__/BookingWizardContent.test.tsx
git commit -m "refactor(agendamentos): BookingModal vira BookingWizardContent sem Dialog proprio"
```

---

### Task 4: Componente `AgendamentoRow`

**Files:**
- Create: `desktop/components/agendamentos/AgendamentoRow.tsx`
- Test: `desktop/src/interface/agendamentos/__tests__/AgendamentoRow.test.tsx` (novo)

**Interfaces:**
- Consumes: `podeCancelarAgendamento` (Task 1), `BookingRow` (Task 2).
- Produces: `AgendamentoRow({ row: BookingRow; onCancelar: (id: string) => Promise<void>; onReenviarWhatsapp: (id: string) => Promise<string | null> })`.
  Task 5 renderiza uma lista de `AgendamentoRow`, uma por item de `tasks` (retornado por `useBookingTasks`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `desktop/src/interface/agendamentos/__tests__/AgendamentoRow.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgendamentoRow } from '@/components/agendamentos/AgendamentoRow';
import type { BookingRow } from '@/src/interface/hooks/queries/useBookingTasks';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const baseRow: BookingRow = {
    id: 'ag-1',
    titulo: 'Maria Souza',
    status: 'confirmado',
    criadoEm: '2026-06-01T10:00:00.000Z',
    atribuidoPara: null,
    clienteTelefone: '11999999999',
    clienteEmail: 'maria@example.com',
    bairro: 'Centro',
    vagasSolicitadas: 1,
    dadosFormulario: { endereco: 'Rua das Flores, 123' },
};

describe('AgendamentoRow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mostra o botao Cancelar quando o status permite cancelamento', () => {
        render(<AgendamentoRow row={baseRow} onCancelar={vi.fn()} onReenviarWhatsapp={vi.fn()} />);
        expect(screen.getByText('Cancelar')).toBeTruthy();
    });

    it('esconde o botao Cancelar quando o agendamento ja foi cancelado', () => {
        render(
            <AgendamentoRow
                row={{ ...baseRow, status: 'cancelado' }}
                onCancelar={vi.fn()}
                onReenviarWhatsapp={vi.fn()}
            />
        );
        expect(screen.queryByText('Cancelar')).toBeNull();
    });

    it('expande os detalhes ao clicar em Detalhes', async () => {
        render(<AgendamentoRow row={baseRow} onCancelar={vi.fn()} onReenviarWhatsapp={vi.fn()} />);

        fireEvent.click(screen.getByText('Detalhes'));

        expect(await screen.findByText('Telefone: 11999999999')).toBeTruthy();
        expect(screen.getByText('E-mail: maria@example.com')).toBeTruthy();
        expect(screen.getByText('endereco: Rua das Flores, 123')).toBeTruthy();
    });

    it('confirma o cancelamento e chama onCancelar com o id do agendamento', async () => {
        const onCancelar = vi.fn().mockResolvedValue(undefined);
        render(<AgendamentoRow row={baseRow} onCancelar={onCancelar} onReenviarWhatsapp={vi.fn()} />);

        fireEvent.click(screen.getByText('Cancelar'));
        fireEvent.click(await screen.findByText('Cancelar agendamento'));

        await waitFor(() => {
            expect(onCancelar).toHaveBeenCalledWith('ag-1');
        });
        expect(toast.success).toHaveBeenCalled();
    });

    it('abre o link de whatsapp retornado ao reenviar', async () => {
        const onReenviarWhatsapp = vi.fn().mockResolvedValue('https://wa.me/5511999999999');
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        render(<AgendamentoRow row={baseRow} onCancelar={vi.fn()} onReenviarWhatsapp={onReenviarWhatsapp} />);
        fireEvent.click(screen.getByText('WhatsApp'));

        await waitFor(() => {
            expect(openSpy).toHaveBeenCalledWith('https://wa.me/5511999999999', '_blank', 'noopener,noreferrer');
        });
        openSpy.mockRestore();
    });

    it('mostra erro quando nao ha link de whatsapp disponivel', async () => {
        const onReenviarWhatsapp = vi.fn().mockResolvedValue(null);
        render(<AgendamentoRow row={baseRow} onCancelar={vi.fn()} onReenviarWhatsapp={onReenviarWhatsapp} />);

        fireEvent.click(screen.getByText('WhatsApp'));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Nenhum link de WhatsApp disponível para este agendamento.');
        });
    });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/interface/agendamentos/__tests__/AgendamentoRow.test.tsx`
Expected: FAIL — `@/components/agendamentos/AgendamentoRow` não existe.

- [ ] **Step 3: Implementar**

Criar `desktop/components/agendamentos/AgendamentoRow.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronUp, MessageCircle, UserCheck, XCircle } from "lucide-react";
import { podeCancelarAgendamento } from "@/src/domain/service/Agendamento";
import type { BookingRow } from "@/src/interface/hooks/queries/useBookingTasks";
import { toast } from "sonner";

interface AgendamentoRowProps {
    row: BookingRow;
    onCancelar: (id: string) => Promise<void>;
    onReenviarWhatsapp: (id: string) => Promise<string | null>;
}

const STATUS_LABEL: Record<BookingRow["status"], string> = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    realizado: "Realizado",
    cancelado: "Cancelado",
};

export function AgendamentoRow({ row, onCancelar, onReenviarWhatsapp }: AgendamentoRowProps) {
    const [expanded, setExpanded] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

    const podeCancelar = podeCancelarAgendamento(row.status);
    const formEntries = Object.entries(row.dadosFormulario).filter(
        ([, valor]) => valor !== null && valor !== undefined && valor !== ""
    );

    const confirmCancelar = async () => {
        try {
            await onCancelar(row.id);
            toast.success("Agendamento cancelado");
        } catch (e) {
            toast.error("Erro ao cancelar: " + (e as Error).message);
        } finally {
            setCancelOpen(false);
        }
    };

    const handleReenviarWhatsapp = async () => {
        setSendingWhatsapp(true);
        try {
            const link = await onReenviarWhatsapp(row.id);
            if (!link) {
                toast.error("Nenhum link de WhatsApp disponível para este agendamento.");
                return;
            }
            window.open(link, "_blank", "noopener,noreferrer");
        } catch (e) {
            toast.error("Erro ao gerar link: " + (e as Error).message);
        } finally {
            setSendingWhatsapp(false);
        }
    };

    return (
        <div className="rounded-md border px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="font-medium leading-tight">{row.titulo}</p>
                    {row.atribuidoPara && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <UserCheck className="h-3 w-3" />
                            {row.atribuidoPara}
                        </p>
                    )}
                </div>
                <Badge
                    variant={row.status === "confirmado" ? "default" : row.status === "cancelado" ? "secondary" : "outline"}
                    className="text-xs"
                >
                    {STATUS_LABEL[row.status]}
                </Badge>
            </div>

            <Collapsible open={expanded} onOpenChange={setExpanded}>
                <div className="flex items-center gap-1 mt-2">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                            {expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                            Detalhes
                        </Button>
                    </CollapsibleTrigger>
                    <Button variant="ghost" size="sm" className="h-7 px-2" disabled={sendingWhatsapp} onClick={handleReenviarWhatsapp}>
                        <MessageCircle className="h-3.5 w-3.5 mr-1" />
                        WhatsApp
                    </Button>
                    {podeCancelar && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setCancelOpen(true)}
                        >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancelar
                        </Button>
                    )}
                </div>

                <CollapsibleContent className="mt-2 space-y-1 text-xs text-muted-foreground border-t pt-2">
                    {row.clienteTelefone && <p>Telefone: {row.clienteTelefone}</p>}
                    {row.clienteEmail && <p>E-mail: {row.clienteEmail}</p>}
                    {row.bairro && <p>Bairro: {row.bairro}</p>}
                    <p>Vagas solicitadas: {row.vagasSolicitadas}</p>
                    {formEntries.map(([campo, valor]) => (
                        <p key={campo}>{campo}: {String(valor)}</p>
                    ))}
                </CollapsibleContent>
            </Collapsible>

            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O agendamento de {row.titulo} será cancelado e a vaga voltará a ficar disponível no
                            slot. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmCancelar}>Cancelar agendamento</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/interface/agendamentos/__tests__/AgendamentoRow.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add components/agendamentos/AgendamentoRow.tsx src/interface/agendamentos/__tests__/AgendamentoRow.test.tsx
git commit -m "feat(agendamentos): adiciona AgendamentoRow com detalhes, whatsapp e cancelamento"
```

---

### Task 5: Reescrever `app/agendamentos/page.tsx`

**Files:**
- Modify: `desktop/app/agendamentos/page.tsx` (inteiro, 474 linhas — só `SlotDetailSheet` e
  `AgendamentosPage` mudam; `VistaLista`, `VistaCalendario`, `SlotCard`, `CapacidadeBar` e as funções
  helper de topo ficam idênticas)

**Interfaces:**
- Consumes: `BookingWizardContent` (Task 3), `AgendamentoRow` (Task 4), `useBookingTasks`/`BookingRow`
  (Task 2), `useAgendamentoMutations().cancelarAgendamento`/`findLinkWhatsApp` (já existentes).
- Produces: nenhuma interface nova para tasks seguintes — este é o ponto de integração final da UI.
  Task 6 testa este arquivo importando o default export `AgendamentosPage` de `@/app/agendamentos/page`.

**Rename de prop:** `SlotDetailSheetProps.onBookingCreated: () => void` (original) vira
`onSlotChanged: () => void` — o nome muda porque o callback agora dispara tanto após criar quanto após
cancelar um agendamento (Task 1/2 do objetivo), não só após criar. `onClose: () => void` **não muda**
— já tinha essa assinatura no componente original (o `agendamentoId` opcional que existia era do
`onClose` interno do antigo `BookingModal`, já tratado na Nota da Task 3 acima, não deste `onClose` do
Sheet).

- [ ] **Step 1: Substituir todo o conteúdo do arquivo**

Substituir `desktop/app/agendamentos/page.tsx` inteiro por (as seções `parseDate` até
`VistaCalendario`, linhas 1–246 do arquivo original, permanecem — apenas os imports do topo e tudo a
partir de `SlotDetailSheet` mudam):

```tsx
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, List, Plus, Loader2, UserCheck, RefreshCw } from "lucide-react";
import { useServiceSlots, useServiceTypes, useBookingTasks, useAgendamentoMutations } from "@/src/interface/hooks/catalog/service";
import { BookingWizardContent } from "@/components/BookingWizardContent";
import { AgendamentoRow } from "@/components/agendamentos/AgendamentoRow";
import type { ServiceSlot } from "@/src/domain/service/ServiceSlot";
import type { ServiceType } from "@/src/domain/service/ServiceType";
import { toast } from "sonner";

type Visao = "lista" | "calendario";

// ── helpers ──────────────────────────────────────────────────────

function parseDate(iso: string): Date {
    return new Date(iso.slice(0, 10) + "T00:00:00");
}

function formatDate(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

function urgenciaLabel(dataInicio: string): { label: string; variant: "default" | "destructive" | "outline" | "secondary" } | null {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const data = parseDate(dataInicio);
    const diff = Math.floor((data.getTime() - hoje.getTime()) / 86_400_000);

    if (diff < 0) return null; // passado
    if (diff === 0) return { label: "Hoje", variant: "destructive" };
    if (diff === 1) return { label: "Amanhã", variant: "default" };
    if (diff <= 7) return { label: `Em ${diff} dias`, variant: "outline" };
    return null;
}

function pctVagas(ocupadas: number, total: number | null | undefined): number {
    if (!total) return 0;
    return Math.min(1, ocupadas / total);
}

function corVagas(pct: number): string {
    if (pct >= 1) return "bg-muted-foreground";
    if (pct >= 0.85) return "bg-red-500";
    if (pct >= 0.6) return "bg-yellow-500";
    return "bg-green-500";
}

// ── CapacidadeBar ─────────────────────────────────────────────────

function CapacidadeBar({ slot }: { slot: ServiceSlot }) {
    if (!slot.capacidade) return null;
    const pct = pctVagas(slot.vagasOcupadas, slot.capacidade);
    const livres = slot.capacidade - slot.vagasOcupadas;
    return (
        <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                <div
                    className={`h-full rounded-full transition-all ${corVagas(pct)}`}
                    style={{ width: `${Math.min(100, pct * 100)}%` }}
                />
            </div>
            <span className="text-xs text-muted-foreground">
                {pct >= 1 ? "Lotado" : `${livres} vaga${livres !== 1 ? "s" : ""}`}
            </span>
        </div>
    );
}

// ── SlotCard (lista) ──────────────────────────────────────────────

interface SlotCardProps {
    slot: ServiceSlot;
    type: ServiceType | undefined;
    onClick: () => void;
}

function SlotCard({ slot, type, onClick }: SlotCardProps) {
    const urgencia = urgenciaLabel(slot.dataInicio);
    const lotado = !!slot.capacidade && slot.vagasOcupadas >= slot.capacidade;

    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-lg border p-3 space-y-1.5 transition-colors hover:bg-muted/50 ${lotado ? "opacity-60" : ""}`}
        >
            <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm leading-tight">{slot.titulo}</span>
                <div className="flex gap-1 shrink-0">
                    {urgencia && <Badge variant={urgencia.variant} className="text-xs">{urgencia.label}</Badge>}
                    {lotado && <Badge variant="secondary" className="text-xs">Lotado</Badge>}
                </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDate(slot.dataInicio)}
                {slot.dataFim !== slot.dataInicio && ` → ${formatDate(slot.dataFim)}`}
            </div>
            <CapacidadeBar slot={slot} />
        </button>
    );
}

// ── Vista Lista ───────────────────────────────────────────────────

interface VistaListaProps {
    slots: ServiceSlot[];
    typeMap: Map<string, ServiceType>;
    onSlotClick: (slot: ServiceSlot) => void;
}

function VistaLista({ slots, typeMap, onSlotClick }: VistaListaProps) {
    const sorted = useMemo(() => [...slots].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)), [slots]);

    const byType = useMemo(() => {
        const map: Record<string, ServiceSlot[]> = {};
        for (const s of sorted) {
            if (!map[s.serviceTypeId]) map[s.serviceTypeId] = [];
            map[s.serviceTypeId].push(s);
        }
        return map;
    }, [sorted]);

    if (sorted.length === 0) {
        return <p className="text-muted-foreground text-center py-12">Nenhum slot publicado no momento.</p>;
    }

    return (
        <div className="space-y-6">
            {Object.entries(byType).map(([typeId, typeSlots]) => {
                const type = typeMap.get(typeId);
                return (
                    <div key={typeId} className="space-y-2">
                        <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                            <span>{type?.icone ?? "🔧"}</span>
                            {type?.nome ?? "Tipo desconhecido"}
                        </h2>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {typeSlots.map(slot => (
                                <SlotCard key={slot.id} slot={slot} type={type} onClick={() => onSlotClick(slot)} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Vista Calendário ──────────────────────────────────────────────

interface VistaCalendarioProps {
    slots: ServiceSlot[];
    typeMap: Map<string, ServiceType>;
    onSlotClick: (slot: ServiceSlot) => void;
}

function VistaCalendario({ slots, typeMap, onSlotClick }: VistaCalendarioProps) {
    const hoje = new Date();
    const [ano, setAno] = useState(hoje.getFullYear());
    const [mes, setMes] = useState(hoje.getMonth()); // 0-based

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const inicioDaSemana = primeiroDia.getDay(); // 0=dom

    const slotsByDay = useMemo(() => {
        const map: Record<number, ServiceSlot[]> = {};
        for (const slot of slots) {
            const d = parseDate(slot.dataInicio);
            if (d.getFullYear() === ano && d.getMonth() === mes) {
                const dia = d.getDate();
                if (!map[dia]) map[dia] = [];
                map[dia].push(slot);
            }
        }
        return map;
    }, [slots, ano, mes]);

    const nomeMes = primeiroDia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const prevMes = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
    const nextMes = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };

    const cells: (number | null)[] = [
        ...Array(inicioDaSemana).fill(null),
        ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={prevMes}>‹</Button>
                <span className="font-medium capitalize">{nomeMes}</span>
                <Button variant="ghost" size="sm" onClick={nextMes}>›</Button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden text-center text-xs font-medium">
                {diasSemana.map(d => (
                    <div key={d} className="bg-muted py-1.5 text-muted-foreground">{d}</div>
                ))}
                {cells.map((dia, i) => {
                    const slotsNoDia = dia ? (slotsByDay[dia] ?? []) : [];
                    const isHoje = dia && new Date(ano, mes, dia).toDateString() === hoje.toDateString();
                    return (
                        <div
                            key={i}
                            className={`bg-background min-h-[64px] p-1 ${!dia ? "opacity-0" : ""} ${isHoje ? "ring-1 ring-inset ring-primary" : ""}`}
                        >
                            {dia && (
                                <>
                                    <span className={`text-xs ${isHoje ? "font-bold text-primary" : "text-muted-foreground"}`}>{dia}</span>
                                    <div className="mt-0.5 space-y-0.5">
                                        {slotsNoDia.slice(0, 3).map(slot => {
                                            const type = typeMap.get(slot.serviceTypeId);
                                            const cor = type?.cor ?? "#6366f1";
                                            return (
                                                <button
                                                    key={slot.id}
                                                    onClick={() => onSlotClick(slot)}
                                                    className="w-full text-left truncate rounded px-1 py-0.5 text-[10px] text-white leading-tight"
                                                    style={{ backgroundColor: cor }}
                                                    title={slot.titulo}
                                                >
                                                    {slot.titulo}
                                                </button>
                                            );
                                        })}
                                        {slotsNoDia.length > 3 && (
                                            <span className="text-[10px] text-muted-foreground">+{slotsNoDia.length - 3}</span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── SlotDetailSheet ───────────────────────────────────────────────

type SheetModo = "detalhes" | "wizard";

interface SlotDetailSheetProps {
    slot: ServiceSlot | null;
    type: ServiceType | undefined;
    open: boolean;
    onClose: () => void;
    onSlotChanged: () => void;
}

function SlotDetailSheet({ slot, type, open, onClose, onSlotChanged }: SlotDetailSheetProps) {
    const { tasks, loading: tasksLoading, error: tasksError, hasMore, loadMore, reload: reloadTasks } = useBookingTasks(slot?.id ?? null);
    const { cancelarAgendamento, findLinkWhatsApp } = useAgendamentoMutations();
    const [modo, setModo] = useState<SheetModo>("detalhes");

    useEffect(() => {
        if (open) setModo("detalhes");
    }, [open, slot?.id]);

    const handleCancelar = useCallback(async (agendamentoId: string) => {
        await cancelarAgendamento(agendamentoId);
        await reloadTasks();
        onSlotChanged();
    }, [cancelarAgendamento, reloadTasks, onSlotChanged]);

    const handleReenviarWhatsapp = useCallback((agendamentoId: string) => {
        return findLinkWhatsApp(agendamentoId);
    }, [findLinkWhatsApp]);

    const handleWizardCompleted = useCallback(() => {
        setModo("detalhes");
        reloadTasks();
        onSlotChanged();
    }, [reloadTasks, onSlotChanged]);

    if (!slot) return null;

    const urgencia = urgenciaLabel(slot.dataInicio);
    const pct = pctVagas(slot.vagasOcupadas, slot.capacidade);
    const livres = slot.capacidade ? slot.capacidade - slot.vagasOcupadas : null;

    return (
        <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
            <SheetContent className={`w-full overflow-y-auto ${modo === "wizard" ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
                <SheetHeader>
                    {modo === "wizard" ? (
                        <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 w-fit" onClick={() => setModo("detalhes")}>
                            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                            Voltar
                        </Button>
                    ) : (
                        <SheetTitle className="flex items-center gap-2">
                            <span>{type?.icone ?? "🔧"}</span>
                            <span>{type?.nome}</span>
                        </SheetTitle>
                    )}
                </SheetHeader>

                {modo === "wizard" ? (
                    <BookingWizardContent
                        slotId={slot.id}
                        onCancel={() => setModo("detalhes")}
                        onCompleted={handleWizardCompleted}
                    />
                ) : (
                    <div className="mt-4 space-y-4">
                        {/* Slot info */}
                        <div className="space-y-2">
                            <p className="font-medium">{slot.titulo}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(slot.dataInicio)}
                                {slot.dataFim !== slot.dataInicio && ` → ${formatDate(slot.dataFim)}`}
                            </div>
                            {slot.local && (
                                <p className="text-sm text-muted-foreground">{slot.local}</p>
                            )}
                            {urgencia && <Badge variant={urgencia.variant}>{urgencia.label}</Badge>}
                        </div>

                        {/* Capacidade */}
                        {slot.capacidade && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Vagas ocupadas</span>
                                    <span>{slot.vagasOcupadas} / {slot.capacidade}</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${corVagas(pct)}`}
                                        style={{ width: `${Math.min(100, pct * 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {pct >= 1 ? "Slot lotado" : `${livres} vaga${livres !== 1 ? "s" : ""} disponív${livres !== 1 ? "eis" : "el"}`}
                                </p>
                            </div>
                        )}

                        <Separator />

                        {/* Ações */}
                        <Button
                            className="w-full"
                            disabled={!!slot.capacidade && slot.vagasOcupadas >= slot.capacidade}
                            onClick={() => setModo("wizard")}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Registrar agendamento
                        </Button>

                        <Separator />

                        {/* Lista de bookings */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                Agendamentos ({tasks.length})
                            </p>

                            {tasksLoading && (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            )}

                            {tasksError && !tasksLoading && (
                                <div className="text-center py-4 space-y-2">
                                    <p className="text-sm text-red-500">Erro ao carregar agendamentos: {tasksError}</p>
                                    <Button variant="outline" size="sm" onClick={() => reloadTasks()}>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                        Tentar novamente
                                    </Button>
                                </div>
                            )}

                            {!tasksLoading && !tasksError && tasks.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Nenhum agendamento registrado.
                                </p>
                            )}

                            {!tasksLoading && !tasksError && tasks.map(row => (
                                <AgendamentoRow
                                    key={row.id}
                                    row={row}
                                    onCancelar={handleCancelar}
                                    onReenviarWhatsapp={handleReenviarWhatsapp}
                                />
                            ))}
                            {hasMore && (
                                <Button variant="outline" size="sm" className="w-full" onClick={loadMore}>
                                    Carregar mais
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

// ── Página principal ──────────────────────────────────────────────

export default function AgendamentosPage() {
    const { slots, loading, reload } = useServiceSlots({ status: "publicado" });
    const { types } = useServiceTypes();
    const [visao, setVisao] = useState<Visao>("lista");
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const typeMap = useMemo(() => new Map(types.map(t => [t.id, t])), [types]);
    const selectedSlot = useMemo(
        () => (selectedSlotId ? slots.find(s => s.id === selectedSlotId) ?? null : null),
        [slots, selectedSlotId]
    );

    const handleSlotClick = useCallback((slot: ServiceSlot) => {
        setSelectedSlotId(slot.id);
        setSheetOpen(true);
    }, []);

    const handleSheetClose = useCallback(() => {
        setSheetOpen(false);
    }, []);

    const handleSlotChanged = useCallback(() => {
        reload();
    }, [reload]);

    useEffect(() => {
        if (sheetOpen && !loading && selectedSlotId && !selectedSlot) {
            setSheetOpen(false);
            toast.error("Este slot não está mais disponível.");
        }
    }, [sheetOpen, loading, selectedSlotId, selectedSlot]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Agendamentos</h1>
                    <p className="text-muted-foreground text-sm">
                        Selecione um slot para ver detalhes ou registrar um atendimento.
                    </p>
                </div>
                <div className="flex items-center gap-1 border rounded-md p-0.5">
                    <Button
                        variant={visao === "lista" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setVisao("lista")}
                    >
                        <List className="h-3.5 w-3.5 mr-1" />
                        Lista
                    </Button>
                    <Button
                        variant={visao === "calendario" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setVisao("calendario")}
                    >
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        Calendário
                    </Button>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {!loading && visao === "lista" && (
                <VistaLista slots={slots} typeMap={typeMap} onSlotClick={handleSlotClick} />
            )}

            {!loading && visao === "calendario" && (
                <VistaCalendario slots={slots} typeMap={typeMap} onSlotClick={handleSlotClick} />
            )}

            <SlotDetailSheet
                slot={selectedSlot}
                type={selectedSlot ? typeMap.get(selectedSlot.serviceTypeId) : undefined}
                open={sheetOpen}
                onClose={handleSheetClose}
                onSlotChanged={handleSlotChanged}
            />
        </div>
    );
}
```

- [ ] **Step 2: Verificar a tipagem do projeto**

Run: `npx tsc --noEmit`
Expected: Sem novos erros de tipo introduzidos por este arquivo (erros pré-existentes em outros
arquivos do branch atual, se houver, não são deste plano).

- [ ] **Step 3: Commit**

```bash
git add app/agendamentos/page.tsx
git commit -m "feat(agendamentos): unifica wizard no Sheet lateral e adiciona acoes por agendamento"
```

---

### Task 6: Testes de integração de `AgendamentosPage`

**Files:**
- Test: `desktop/src/interface/agendamentos/__tests__/AgendamentosPage.test.tsx` (novo)

**Interfaces:**
- Consumes: `AgendamentosPage` (default export de `app/agendamentos/page.tsx`, Task 5).

- [ ] **Step 1: Escrever os testes**

Criar `desktop/src/interface/agendamentos/__tests__/AgendamentosPage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgendamentosPage from '@/app/agendamentos/page';

const toastError = vi.fn();
vi.mock('sonner', () => ({
    toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() },
}));

vi.mock('@/components/BookingWizardContent', () => ({
    BookingWizardContent: ({ onCancel }: { onCancel: () => void }) => (
        <div data-testid="wizard-content">
            <button onClick={onCancel}>mock-voltar-wizard</button>
        </div>
    ),
}));

let mockSlots: unknown[] = [];
const mockReload = vi.fn();

vi.mock('@/src/interface/hooks/catalog/service', () => ({
    useServiceSlots: () => ({ slots: mockSlots, loading: false, reload: mockReload }),
    useServiceTypes: () => ({ types: [{ id: 'tipo-1', nome: 'Coleta de óleo', icone: '🛢️' }] }),
    useBookingTasks: () => ({
        tasks: [],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: vi.fn(),
        reload: vi.fn(),
    }),
    useAgendamentoMutations: () => ({
        cancelarAgendamento: vi.fn(),
        findLinkWhatsApp: vi.fn(),
    }),
}));

function makeSlot(overrides: Record<string, unknown> = {}) {
    return {
        id: 'slot-1',
        serviceTypeId: 'tipo-1',
        titulo: 'Coleta Bairro Centro',
        dataInicio: '2026-07-10',
        dataFim: '2026-07-10',
        capacidade: 10,
        vagasOcupadas: 3,
        status: 'publicado',
        bairros: [],
        local: null,
        ...overrides,
    };
}

describe('AgendamentosPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSlots = [makeSlot()];
    });

    it('abre o Sheet em modo detalhes ao selecionar um slot', () => {
        render(<AgendamentosPage />);

        fireEvent.click(screen.getByText('Coleta Bairro Centro'));

        expect(screen.getByText('Registrar agendamento')).toBeTruthy();
    });

    it('deriva o slot selecionado a partir da lista mais recente apos reload', () => {
        const { rerender } = render(<AgendamentosPage />);
        fireEvent.click(screen.getByText('Coleta Bairro Centro'));

        expect(screen.getByText('3 / 10')).toBeTruthy();

        mockSlots = [makeSlot({ vagasOcupadas: 4 })];
        rerender(<AgendamentosPage />);

        expect(screen.getByText('4 / 10')).toBeTruthy();
    });

    it('fecha o Sheet e mostra toast quando o slot selecionado some da lista', async () => {
        const { rerender } = render(<AgendamentosPage />);
        fireEvent.click(screen.getByText('Coleta Bairro Centro'));
        expect(screen.getByText('Registrar agendamento')).toBeTruthy();

        mockSlots = [];
        rerender(<AgendamentosPage />);

        await waitFor(() => {
            expect(screen.queryByText('Registrar agendamento')).toBeNull();
        });
        expect(toastError).toHaveBeenCalledWith('Este slot não está mais disponível.');
    });

    it('alterna para o modo wizard e volta para detalhes sem fechar o Sheet', () => {
        render(<AgendamentosPage />);
        fireEvent.click(screen.getByText('Coleta Bairro Centro'));

        fireEvent.click(screen.getByText('Registrar agendamento'));
        expect(screen.getByTestId('wizard-content')).toBeTruthy();
        expect(screen.queryByText('Registrar agendamento')).toBeNull();

        fireEvent.click(screen.getByText('mock-voltar-wizard'));
        expect(screen.getByText('Registrar agendamento')).toBeTruthy();
    });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/interface/agendamentos/__tests__/AgendamentosPage.test.tsx`
Expected: PASS (4 testes). Se algum falhar por causa de texto duplicado (ex.: "Coleta Bairro Centro"
aparecendo tanto no card da lista quanto em algum outro lugar), ajustar o seletor para
`screen.getAllByText(...)[0]` ou usar `within()` isolando o container — mas com a estrutura acima
(um único slot mockado) não deve haver duplicidade.

- [ ] **Step 3: Rodar a suíte inteira do domínio de agendamentos para garantir que nada quebrou**

Run: `npx vitest run src/domain/service/__tests__/Agendamento.test.ts src/interface/hooks/queries/__tests__/useBookingTasks.test.ts src/interface/agendamentos/__tests__/`
Expected: todos os testes das Tasks 1, 2, 3, 4 e 6 passam juntos.

- [ ] **Step 4: Commit**

```bash
git add src/interface/agendamentos/__tests__/AgendamentosPage.test.tsx
git commit -m "test(agendamentos): cobre derivacao de selectedSlot, slot removido e alternancia de modo wizard"
```

---

### Task 7: Verificação manual (Tauri/SQLite real)

Testes automatizados não cobrem o container Tauri real nem a persistência SQLite. Antes de considerar
a feature pronta, rodar manualmente com `npm run start:tauri` (a partir de `desktop/`):

- [ ] **Step 1:** Abrir `/agendamentos`, selecionar um slot publicado com vagas livres — o painel lateral
  abre em modo detalhes, com a lista de agendamentos existentes (se houver) já usando os novos botões
  inline (Detalhes / WhatsApp / Cancelar).
- [ ] **Step 2:** Clicar "Registrar agendamento" — o painel alarga e mostra o wizard (cliente → serviço →
  confirmação) **dentro do mesmo Sheet**, sem abrir um modal central. Clicar "Cancelar" na etapa 1 —
  volta para o modo detalhes sem fechar o painel.
- [ ] **Step 3:** Completar o wizard até o fim (criar um agendamento de teste) — ao clicar "Fechar" na
  etapa 3, o painel volta ao modo detalhes, a lista de agendamentos mostra o novo item, e o contador de
  "Vagas ocupadas" no mesmo painel já reflete o incremento (sem precisar fechar/reabrir o Sheet).
- [ ] **Step 4:** No agendamento recém-criado, clicar "Detalhes" — expande mostrando telefone, e-mail,
  bairro e os campos do formulário preenchido.
- [ ] **Step 5:** Clicar "Cancelar" no mesmo agendamento — abre o diálogo de confirmação; confirmar —
  o item passa a mostrar status "Cancelado", o botão "Cancelar" some daquela linha, e o contador de
  vagas ocupadas no painel diminui imediatamente (mesma correção do Step 3, agora para o caminho
  inverso).
- [ ] **Step 6:** Clicar "WhatsApp" em um agendamento com telefone válido — abre uma nova aba com o link
  gerado por `findLinkWhatsApp`.
- [ ] **Step 7:** Rodar a suíte completa de testes do workspace para garantir que nada mais quebrou:
  `npm run test` (a partir de `desktop/`). Expected: todos os testes passam, incluindo os novos das
  Tasks 1–6.
