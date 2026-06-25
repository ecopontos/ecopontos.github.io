# ADR-040: Gaps identificados no BookingModal — Correções e Decisões de Arquitetura

**Data:** 2026-05-29  
**Status:**Implementado** (2026-06-09)
**Autores:** Equipe EcoForms  
**Componente auditado:** `desktop/components/BookingModal.tsx`

---

## Contexto

Auditoria do `BookingModal` — modal de três etapas (cliente → serviço → confirmação) usado no fluxo de agendamento de serviços — identificou 10 gaps distribuídos em quatro categorias: SQL inline em componente de UI, acesso direto a repositórios fora de hooks, ausência de guard de capacidade e problemas menores de robustez e validação.

---

## Gaps Identificados

### Crítico

#### 1. SQL inline em `useEffect` (linha 107–109)

```ts
getContainerAsync()
  .then(c => c.sqlite.query<UsuarioOption>(
    `SELECT id, nome FROM usuarios WHERE ativo = 1 ORDER BY nome`, []
  ))
  .then(setUsuarios)
```

`useAdminUsers()` já existe e retorna exatamente esses dados. O componente ignora o hook e acessa o SQLite diretamente — violação do princípio de separação de camadas e do catálogo de queries (ADR-031 desktop).

**Decisão:** substituir o `useEffect` + SQL por `useAdminUsers()`, filtrando `u.ativo === true` e mapeando para `{ id, nome }`.

---

### Alto

#### 2. `clienteRepository.save(newCliente as any)` (linha 202)

Acesso direto ao repositório de dentro do componente, com `as any` para contornar incompatibilidade de tipo (`ativo: 1` number vs `ativo: boolean`). `useClienteMutations().save()` já existe, recebe `Cliente` tipado e encapsula o mesmo repositório.

**Decisão:** substituir por `useClienteMutations()` no topo do componente e chamar `save(newCliente)` após corrigir `ativo: 1` → `ativo: true`.

#### 3. Sem guard de capacidade antes de submeter (linha 227)

`handleFormSubmit` não verifica `slot.vagasOcupadas >= slot.capacidade` antes de criar o booking. O badge visual mostra "Lotado" mas não bloqueia a submissão. Existe race condition real: slot pode lotar entre a abertura do modal e o clique de confirmação.

**Decisão:** adicionar guard no topo de `handleFormSubmit`:

```ts
if (slot.capacidade && slot.vagasOcupadas >= slot.capacidade) {
  // exibir erro "Slot lotado. Selecione outro horário."
  return;
}
```

#### 4. Fallback `clienteId: 'anon'` (linha 231)

```ts
clienteId: selectedCliente?.id ?? (dados.cliente_id as string) ?? 'anon'
```

Se `dados.cliente_id` vier vazio (campo apagado dentro do `FormRenderer`), o agendamento é criado com `clienteId = 'anon'` — registro órfão no banco. O botão "Próximo" já exige `selectedCliente` selecionado, mas o dado transita pelo formulário sem garantia de integridade.

**Decisão:** adicionar guard explícita no topo do handler:

```ts
if (!selectedCliente) return;
```

E remover o branch `?? 'anon'` — `clienteId` passa a ser sempre `selectedCliente.id`.

---

### Médio

#### 5. Erro silenciado no `handleQuickCreate` (linha 220)

```ts
} catch {
  // erro ignorado — usuário tenta novamente
}
```

Falha na criação rápida de cliente não tem feedback visual. O botão volta ao estado normal e o usuário não sabe o que aconteceu. Viola o princípio de feedback mínimo de UX.

**Decisão:** adicionar `useState<string | null>(null)` para `quickCreateError` e renderizar mensagem abaixo do formulário quando preenchido.

#### 6. `agendamentoNotificacaoRepo` acessado diretamente na UI (linhas 244–246)

```ts
const c = await getContainerAsync();
const link = await c.agendamentoNotificacaoRepo.findLinkWhatsApp(id);
```

Mesmo padrão do gap 2 — repositório acessado de dentro de componente de UI. `useAgendamentoMutations` já existe e é o lugar correto para encapsular essa busca.

**Decisão:** expor `findLinkWhatsApp(id: string): Promise<string | null>` em `useAgendamentoMutations` e consumir de lá.

---

### Baixo

#### 7. `useEffect` sem cleanup (linhas 105–111)

O `useEffect` que carrega usuários não possui `AbortController` nem flag `mounted`. Se o modal fechar durante a query em voo, `setUsuarios` é chamado em componente desmontado — warning no React 18 strict mode e potencial memory leak em runs subsequentes.

**Decisão:** adicionar flag `let mounted = true` com `return () => { mounted = false }` no cleanup, ou usar `AbortController` se o adapter SQLite suportar.

#### 8. Estado inconsistente na etapa 3 (linha 528)

A condição `etapa === 3 && agendamentoId` renderiza nada se `agendamentoId` for null — tela em branco sem mensagem de erro. Cenário improvável mas possível se `criarBooking` retornar `undefined`.

**Decisão:** adicionar `else` com mensagem de erro de fallback:

```tsx
{etapa === 3 && !agendamentoId && (
  <p className="text-red-500 text-center py-8">Erro ao confirmar agendamento. Tente novamente.</p>
)}
```

#### 9. `formatDate` sem timezone (linha 620–623)

```ts
function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
```

`iso.slice(0, 10)` assume UTC. Em UTC-3, `2026-05-29T01:00:00Z` exibe `29/05` mas deveria ser `28/05` local.

**Decisão:** substituir por:

```ts
new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
```

Ou receber a data já formatada do slot (preferível — única fonte de verdade do TZ).

#### 10. QuickCreate sem validação de documento e telefone

Apenas `quickForm.nome.trim()` é validado antes de salvar o cliente rápido. CPF/CNPJ e telefone são persistidos com dígitos brutos sem verificação de dígitos verificadores — gera dados sujos no banco que falham em consultas e relatórios posteriores.

**Decisão:** adicionar validação mínima antes de habilitar o botão "Salvar":
- Documento: se preenchido, verificar módulo 11 (CPF) ou módulo 11 CNPJ
- Telefone: se preenchido, exigir mínimo 10 dígitos

Utilitários de validação já existem em `ecoforms-core` — verificar disponibilidade antes de reimplementar.

---

## Resumo Executivo

| # | Gap | Severidade | Esforço |
|---|-----|-----------|---------|
| 1 | SQL inline — usar `useAdminUsers()` | Crítico | Baixo |
| 2 | `clienteRepository.save(as any)` — usar `useClienteMutations()` | Alto | Baixo |
| 3 | Sem guard de capacidade antes de submit | Alto | Baixo |
| 4 | `clienteId: 'anon'` fallback perigoso | Alto | Baixo |
| 5 | Erro silenciado no QuickCreate | Médio | Baixo |
| 6 | `agendamentoNotificacaoRepo` direto na UI | Médio | Médio |
| 7 | `useEffect` sem cleanup | Baixo | Baixo |
| 8 | Etapa 3 sem fallback se `agendamentoId` null | Baixo | Baixo |
| 9 | `formatDate` sem timezone | Baixo | Baixo |
| 10 | QuickCreate sem validação de doc/telefone | Baixo | Médio |

**Itens 1–4 devem ser corrigidos antes do próximo release** — os demais podem ser agrupados em um ciclo de hardening posterior.

---

## Relação com ADRs Existentes

- **ADR-031 (desktop):** gaps 1 e 6 são instâncias exatas do padrão de SQL inline e acesso direto a repositório que o QueryCatalog visa eliminar — este componente deve ser incluído no escopo da Fase 5 de migração.
- **ADR-032/036 (caixas/kanban):** padrão de QuickCreate sem validação pode existir em modais similares — verificar `CaixasModal`, `KanbanCard` e demais modais de criação rápida.
