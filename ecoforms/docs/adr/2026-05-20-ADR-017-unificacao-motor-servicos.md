# ADR-017 — Unificação do Motor de Agendamento e Tarefas em Unified Service Engine

- **Status**: **Superseded** (ADR-015 foi o caminho escolhido; ADR-018 implementou booking engine)
- **Superado em**: 2026-06-18 (auditoria)
- **Data**: 2026-05-20
- **Autor**: Engenharia
- **Decisor**: Rejeitado em favor de ADR-015 (abordagem incremental)
- **Ciclo de vida**: Proposto → Aceito (aprovação do time) → Implementado (critérios de aceitação verificados por `grep`) → Supersedido
- **Relacionados**: ADR-014 (Adequação Arquitetural), ADR-015 (Motor de Agendamento Compartilhado), ADR-016 (Workflow Ouvidoria)
- **Alternativa**: ADR-015 propõe abordagem mais conservadora — extrair motor para `packages/core/scheduling/` mantendo domínios separados. Este ADR propõe fusão completa dos domínios.
- **Pré-requisitos**: Decisão sobre abordagem (ADR-015 vs ADR-017) antes de implementação

---

## Contexto

O sistema possui dois módulos com lógica de datas e ciclo de vida sobreposta:

### Módulo de Agendamento (`domain/agendamento/`)

Gerencia **slots** (janelas de tempo) e **agendamentos** (reservas dentro de slots) para três tipos de serviço: `museu`, `volumosos`, `evento`.

**Pontos fortes:**
- Motor de slots com `dataInicio`/`dataFim`, `horarioInicio`/`horarioFim`
- Controle de capacidade (`vagas`) com cálculo via SQL
- Validação por tipo via Strategy Pattern (`MuseuValidator`, `VolumososValidator`, `EventoValidator`)
- Sistema de fotos com sync para Supabase Storage
- Despacho que cria Demandas + Tasks no Kanban

**Pontos fracos:**
- Sem integração com FormBuilder — cada tipo tem UI hardcoded
- Sem recorrência — slots são eventos únicos
- Tipos fechados (`'museu' | 'volumosos' | 'evento'`) — adicionar tipo exige editar código

### Módulo de Tarefas (`domain/task/`)

Gerencia **tasks** no Kanban com prazos, prioridades, atribuição e formulários vinculados.

**Pontos fortes:**
- Integração madura com FormBuilder (`form_registry_id`)
- Sistema de recorrência (`TaskRecurrence`: diária, semanal, mensal, anual)
- Visualização Kanban nativa
- Métricas e analytics
- Hierarquia de subtarefas

**Pontos fracos:**
- Sem controle de capacidade
- Sem validação por tipo de serviço
- Sem sistema de fotos com sync
- Sem janelas de tempo — apenas prazos pontuais ou períodos

### Fluxo Natural de Convergência

O despacho de agendamento já cria Tasks no Kanban (`DispatchAgendamentoUseCase`, `DispatchSlotUseCase`). Ou seja, o sistema já reconhece implicitamente que agendamentos **se tornam** tarefas. A separação atual força duas entidades distintas para o mesmo conceito.

### Sobreposição de Responsabilidades

| Conceito | Agendamento | Tarefas | Duplicação |
|----------|-------------|---------|------------|
| Janela de tempo | `dataInicio`-`dataFim` | `prazo`-`prazoFim` | 🔴 Alta |
| State machine | 2 máquinas (Slot + Agendamento) | 1 máquina (Task) | 🟡 Média |
| Integração Kanban | Despacho cria Tasks | É o Kanban | 🔴 Alta |
| FormBuilder | ❌ Não integrado | ✅ Integrado | 🔴 Alta |
| Validação por tipo | ✅ Strategy Pattern | ❌ Genérico | 🟡 Média |
| Fotos com sync | ✅ AgendamentoFoto | ❌ Sem suporte | 🟡 Média |
| Capacidade/Vagas | ✅ SQL calculado | ❌ Sem suporte | 🟡 Média |

---

## Decisão

Adotar um **Unified Service Engine** que transforma o módulo de agendamento em um **módulo dinâmico**, onde:

1. **Service** — entidade genérica que define qualquer tipo de serviço agendável (não mais fixo em museu/volumosos/evento)
2. **ServiceInstance** — ocorrência/execução de um serviço, com dados dinâmicos preenchidos via FormBuilder
3. **ServiceTypeRegistry** — registry dinâmico de tipos de serviço, criados via administração (não mais hardcoded)

### Princípio: Módulo de agendamento dinâmico

O módulo de agendamento deixa de ser um módulo com tipos fixos (museu, volumosos, evento) e se torna um **motor genérico** onde:

- **Qualquer tipo de serviço** pode ser criado via administração
- **Cada tipo** define seu próprio formulário no FormBuilder
- **O motor** (slots, capacidade, validação, ciclo de vida) funciona com qualquer tipo
- **A UI** renderiza dinamicamente baseado no tipo e formulário

```
ANTES (tipos fixos):
┌─────────────────────────────────────────┐
│         Módulo de Agendamento           │
│  ┌──────┐ ┌──────────┐ ┌──────────┐   │
│  │Museu │ │Volumosos │ │  Evento  │   │
│  │(fixo)│ │ (fixo)   │ │  (fixo)  │   │
│  └──────┘ └──────────┘ └──────────┘   │
│  UI hardcoded por tipo                  │
└─────────────────────────────────────────┘

DEPOIS (módulo dinâmico):
┌─────────────────────────────────────────────────────────┐
│              Unified Service Engine                      │
│  ┌─────────────────────────────────────────────────────┐│
│  │           ServiceTypeRegistry (dinâmico)            ││
│  │  ┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  ││
│  │  │Museu │ │Volumosos │ │  Remoção │ │   Poda   │  ││
│  │  │      │ │          │ │          │ │          │  ││
│  │  └──────┘ └──────────┘ └──────────┘ └──────────┘  ││
│  │       ... qualquer tipo pode ser adicionado ...     ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │              Motor Genérico                         ││
│  │  • Slots (janelas de tempo)                         ││
│  │  • Capacidade (vagas)                               ││
│  │  • Validação por tipo (Strategy Pattern)            ││
│  │  • Ciclo de vida (rascunho → publicado → encerrado) ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │              UI Dinâmica                            ││
│  │  • Formulário renderizado via FormRenderer          ││
│  │  • Campos específicos por tipo de serviço           ││
│  │  • Validação dinâmica via schema                    ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Comparação com ADR-015 (abordagem conservadora)

| Aspecto | ADR-015 (conservador) | ADR-017 (dinâmico) |
|---------|----------------------|-------------------|
| Tipos de serviço | Fixos (museu, volumosos, evento) | Dinâmicos (qualquer tipo via admin) |
| Formulários | Schema hardcoded por tipo | FormBuilder dinâmico por tipo |
| UI | Plugin Registry com componentes fixos | FormRenderer dinâmico |
| Validação | Validators fixos | Validators + schema do form |
| Domínios | Mantém `agendamento/` e `task/` separados | Funde em `service/` |
| Tabelas | Mantém `tbl_agendamento_slots`, `tbl_agendamentos`, `tarefas` | Nova `tbl_services`, `tbl_service_instances` |
| Migração de dados | Não necessária | Necessária (~1 semana) |
| Risco | Baixo | Médio-alto |
| Breaking changes | Mínimos | Significativos |
| Consistência conceitual | Dois sistemas com motor compartilhado | Um sistema dinâmico unificado |

**Quando escolher ADR-015**: Se o time quer melhorias incrementais sem quebrar o que funciona.
**Quando escolher ADR-017**: Se o time quer um módulo de agendamento dinâmico e extensível.

---

## Modelo de Domínio

### Service (equivalente a AgendamentoSlot + conceito de "projeto de tarefa")

```typescript
interface ServiceProps {
    id: string;                          // uuidv7
    tipoId: string;                      // 'museu' | 'volumosos' | 'remocao' | 'poda' | ...
    titulo: string;
    descricao?: string;
    dataInicio: string;                  // ISO date
    dataFim: string;                     // ISO date
    horarioInicio?: string;              // HH:MM
    horarioFim?: string;                 // HH:MM
    capacidade?: number | null;          // null = sem limite
    bairros?: string[];                  // restrição geográfica
    local?: string;
    formRegistryId?: string;             // formulário vinculado (NOVO)
    status: ServiceStatus;
    criadoPor: string;
    criadoEm: string;
    atualizadoEm: string;
}

type ServiceStatus = 'rascunho' | 'publicado' | 'em_execucao' | 'encerrado' | 'cancelado';
```

**Transições válidas:**
```
rascunho ──publish──> publicado ──start──> em_execucao ──encerrar──> encerrado
    │                    │                    │
    └──cancel──> cancelado <──cancel──────────┘
```

### ServiceInstance (equivalente a Agendamento + Task individual)

```typescript
interface ServiceInstanceProps {
    id: string;                          // uuidv7
    serviceId: string;                   // FK para Service
    clienteId?: string;                  // cidadão (agendamento) ou null
    atribuidoPara?: string;              // operador (task) ou null
    dadosFormulario?: Record<string, any>; // dados do FormBuilder (NOVO)
    fotosCount?: number;                 // controle de fotos
    prazo?: string;                      // ISO date (derivado da janela ou manual)
    prioridade?: 'baixa' | 'media' | 'alta';
    ordem?: number;                      // posição no Kanban
    status: ServiceInstanceStatus;
    motivoCancelamento?: string;
    criadoPor: string;
    criadoEm: string;
    atualizadoEm: string;
    confirmadoPor?: string;
    confirmadoEm?: string;
    concluidoPor?: string;
    concluidoEm?: string;
}

type ServiceInstanceStatus = 'pendente' | 'confirmado' | 'em_campo' | 'concluido' | 'cancelado';
```

**Transições válidas (unifica Agendamento + Task):**
```
pendente ──confirm──> confirmado ──start──> em_campo ──concluir──> concluido
    │                    │                    │
    └──cancel──> cancelado <──cancel──────────┘
```

**Mapeamento de status legados:**
| Status Agendamento | Status Task | Status Unificado |
|--------------------|-------------|------------------|
| `pendente` | `a_fazer` | `pendente` |
| `confirmado` | `em_progresso` | `confirmado` |
| — | `em_progresso` (executando) | `em_campo` |
| `realizado` | `concluido` | `concluido` |
| `cancelado` | `cancelado` | `cancelado` |

### ServiceTypeRegistry (dinâmico, expansível)

```typescript
interface ServiceTypeConfig {
    tipoId: string;                    // identificador único (ex: 'museu', 'remocao', 'poda')
    nome: string;                      // nome legível
    descricao?: string;                // descrição do serviço
    formRegistryId?: string;           // formulário vinculado no FormBuilder
    validator?: ServiceValidator;      // validador específico (opcional)
    capacidadeDefault?: number;        // capacidade padrão para novos slots
    requerCliente: boolean;            // true = agendamento cidadão, false = tarefa interna
    requerFotos: boolean;              // exige fotos (volumosos, remoção)
    bairrosObrigatorios: boolean;      // exige seleção de bairro
    icone?: string;                    // ícone para UI
    cor?: string;                      // cor para UI
    ativo: boolean;                    // pode ser desativado sem deletar
    criadoEm: string;
    atualizadoEm: string;
}

// Registry dinâmico — tipos são criados via administração
class ServiceTypeRegistry {
    private static types: Map<string, ServiceTypeConfig> = new Map();

    // Registrar tipo (chamado ao criar/editar via admin)
    static register(config: ServiceTypeConfig): void {
        this.types.set(config.tipoId, config);
    }

    // Buscar tipo
    static get(tipoId: string): ServiceTypeConfig | undefined {
        return this.types.get(tipoId);
    }

    // Listar todos os tipos ativos
    static listActive(): ServiceTypeConfig[] {
        return Array.from(this.types.values()).filter(t => t.ativo);
    }

    // Listar todos os tipos (incluindo inativos)
    static listAll(): ServiceTypeConfig[] {
        return Array.from(this.types.values());
    }

    // Desativar tipo
    static deactivate(tipoId: string): void {
        const config = this.types.get(tipoId);
        if (config) {
            config.ativo = false;
            config.atualizadoEm = new Date().toISOString();
        }
    }

    // Atualizar configuração
    static update(tipoId: string, updates: Partial<ServiceTypeConfig>): void {
        const config = this.types.get(tipoId);
        if (config) {
            Object.assign(config, updates, { atualizadoEm: new Date().toISOString() });
        }
    }
}
```

### Persistência de tipos de serviço

Os tipos de serviço são persistidos no SQLite para sobreviver a reinicializações:

```sql
CREATE TABLE IF NOT EXISTS tbl_service_types (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    form_registry_id TEXT,
    validator_class TEXT,           -- nome da classe do validador
    capacidade_default INTEGER,
    requer_cliente INTEGER NOT NULL DEFAULT 1,
    requer_fotos INTEGER NOT NULL DEFAULT 0,
    bairros obrigatorios INTEGER NOT NULL DEFAULT 0,
    icone TEXT,
    cor TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT datetime('now'),
    atualizado_em TEXT NOT NULL DEFAULT datetime('now')
);
```

### Criação de tipo via administração

```
Admin → /admin/service-types → Novo Tipo
├── Nome: "Capina Mecânica"
├── Descrição: "Serviço de capina mecânica em áreas públicas"
├── Formulário: [Selecionar do FormBuilder] → "form-capina-001"
├── Capacidade padrão: 5
├── Requer cliente: Não (tarefa interna)
├── Requer fotos: Sim
├── Bairros obrigatórios: Não
├── Ícone: "🌿"
├── Cor: "#22c55e"
└── Salvar → ServiceTypeRegistry.register(...)
```

### Exemplo: Criando formulário para "Capina Mecânica"

**Passo 1 — Criar formulário no FormBuilder:**
```
/forms → Novo Formulário → "Capina Mecânica"
├── Campo: area_m2 (number, required)
├── Campo: tipo_vegetacao (select: grama, arbusto, árvore pequena, misto)
├── Campo: equipamento (select: roçadeira, motosserra, cortador de cerca)
├── Campo: fotos_antes (gallery, min 1)
├── Campo: fotos_depois (gallery)
├── Campo: observacoes (textarea)
└── Salvar → formRegistryId: "form-capina-001"
```

**Passo 2 — Registrar tipo de serviço via admin:**
```typescript
ServiceTypeRegistry.register({
    tipoId: 'capina_mecanica',
    nome: 'Capina Mecânica',
    formRegistryId: 'form-capina-001',
    validator: new CapinaValidator(),
    capacidadeDefault: 5,
    requerCliente: false,
    requerFotos: true,
    bairrosObrigatorios: false,
    icone: '🌿',
    cor: '#22c55e',
    ativo: true,
});
```

**Passo 3 — Sistema funciona automaticamente:**
- Admin pode criar slots do tipo "Capina Mecânica"
- Formulário é renderizado dinamicamente
- Validação usa `CapinaValidator`
- Dados são salvos em `ServiceInstance.dadosFormulario`

---

## Integração com FormBuilder

### Princípio: Cada serviço define seu próprio formulário

Qualquer tipo de serviço pode criar seu formulário no formbuilder existente para representar os dados necessários do agendamento. O formulário é associado ao tipo de serviço via `ServiceTypeRegistry` e renderizado dinamicamente via `FormRenderer`.

### Fluxo de criação de formulário por tipo

```
1. Admin cria formulário no FormBuilder (/forms)
   └── Schema JSON com campos específicos do serviço
       (ex: tipo_residuo, volume, endereço, fotos, etc.)

2. Admin registra tipo de serviço no ServiceTypeRegistry
   └── Vincula formRegistryId ao tipo
       registerServiceType({ tipoId: 'remocao', formRegistryId: 'form-remocao-001', ... })

3. Sistema renderiza formulário automaticamente
   └── FormRenderer carrega schema do formRegistryId
       ServiceTypeRegistry.get('remocao').formRegistryId → schema

4. Dados são salvos em ServiceInstance.dadosFormulario
   └── JSON com todos os campos preenchidos
```

### Exemplo: Criando formulário para "Remoção de Resíduos"

**Passo 1 — Criar formulário no FormBuilder:**
```
/forms → Novo Formulário → "Remoção de Resíduos"
├── Campo: tipo_residuo (select: entulho, madeira, metal, misto)
├── Campo: volume_estimado (select: até 1m³, 1-3m³, 3-5m³, acima 5m³)
├── Campo: endereco (text, required)
├── Campo: fotos (gallery, min 1)
├── Campo: observacoes (textarea)
└── Salvar → formRegistryId: "form-remocao-001"
```

**Passo 2 — Registrar tipo de serviço:**
```typescript
registerServiceType({
    tipoId: 'remocao',
    nome: 'Remoção de Resíduos',
    formRegistryId: 'form-remocao-001',  // vincula ao form criado
    validator: new RemocaoValidator(),
    requerCliente: false,
    requerFotos: true,
    bairrosObrigatorios: true,
});
```

**Passo 3 — Sistema renderiza automaticamente:**
```tsx
// NovoAgendamentoForm.tsx
const serviceType = ServiceTypeRegistry.get(service.tipoId);
const formSchema = getFormSchema(serviceType.formRegistryId);

<FormRenderer
    schema={formSchema}
    onSubmit={(dados) => createServiceInstance({ ...dados, serviceId: service.id })}
/>
```

### Formulários por tipo de serviço

| Tipo de Serviço | Formulário | Campos principais |
|-----------------|------------|-------------------|
| `museu` | `form-museu-001` | vagas_solicitadas, nome_grupo, responsavel |
| `volumosos` | `form-volumosos-001` | bairro, tipos_residuo[], fotos[], volume_m3 |
| `remocao` | `form-remocao-001` | tipo_residuo, volume_estimado, endereco, fotos[] |
| `poda` | `form-poda-001` | endereco, tipo_arvore, fotos_antes[], urgencia |
| `evento` | `form-evento-001` | nome_evento, num_participantes, descricao |
| `coleta_seletiva` | `form-coleta-001` | materiais[], horario_preferido, endereco |

### Herança de formulários

Tipos de serviço podem herdar formulários de outros tipos:

```typescript
registerServiceType({
    tipoId: 'remocao_urgente',
    nome: 'Remoção Urgente',
    formRegistryId: 'form-remocao-001',  // herda formulário de remoção
    validator: new RemocaoUrgenteValidator(),  // validador mais restritivo
    requerCliente: true,
    requerFotos: true,
    bairrosObrigatorios: true,
});
```

### Override de formulário por Service

Um `Service` específico pode sobrescrever o formulário padrão do tipo:

```typescript
// Service com formulário customizado
const service = await createServiceUseCase.execute({
    tipoId: 'remocao',
    titulo: 'Remoção Especial - Centro',
    formRegistryId: 'form-remocao-especial-001',  // override do form padrão
    // ...
});
```

### Fluxo de dados completo

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  ServiceType    │────>│  Service         │────>│ ServiceInstance │
│  Registry       │     │  (janela+cap.)   │     │ (dados+status)  │
│                 │     │                  │     │                 │
│ formRegistryId  │     │ formRegistryId   │     │ dadosFormulario │
│ validator       │     │ (override)       │     │ fotos[]         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  FormBuilder    │     │  Service         │     │  DispatchPanel  │
│  (schema JSON)  │     │  Repository      │     │  (→ Kanban)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Kanban Board   │
                                                 │  (Tasks)        │
                                                 └─────────────────┘
```

### Exemplo: Remoção de Resíduos

```typescript
// 1. Criar formulário no FormBuilder (/forms)
//    - Campo: tipo_residuo (select: entulho, madeira, metal, misto)
//    - Campo: volume_estimado (select: até 1m³, 1-3m³, 3-5m³, acima 5m³)
//    - Campo: endereco (text, required)
//    - Campo: fotos (gallery, min 1)
//    - Campo: observacoes (textarea)
//    → formRegistryId: "form-remocao-001"

// 2. Registrar tipo de serviço
registerServiceType({
    tipoId: 'remocao',
    nome: 'Remoção de Resíduos',
    formRegistryId: 'form-remocao-001',  // vincula ao form criado
    validator: new RemocaoValidator(),
    requerCliente: false,
    requerFotos: true,
    bairrosObrigatorios: true,
});

// 3. Criar serviço (equivalente a criar slot)
const service = await createServiceUseCase.execute({
    tipoId: 'remocao',
    titulo: 'Remoção - Centro - 2026-05-25',
    dataInicio: '2026-05-25',
    dataFim: '2026-05-25',
    horarioInicio: '08:00',
    horarioFim: '17:00',
    bairros: ['Centro', 'Santa Cruz'],
    capacidade: 10, // 10 atendimentos
});

// 4. Criar instância com dados do formulário
const instance = await createServiceInstanceUseCase.execute({
    serviceId: service.id,
    atribuidoPara: 'operador-001',
    dadosFormulario: {
        tipo_residuo: 'entulho',
        volume_estimado: '2m3',
        endereco: 'Rua XV de Novembro, 123',
        fotos: ['foto1.jpg', 'foto2.jpg'],
    },
    prioridade: 'alta',
});

// 5. Operador visualiza no Kanban após despacho
// DispatchPanel cria Task com dados do ServiceInstance
```

---

## Integração com Kanban

### Princípio: Motor unificado, UI separada

O motor de serviço (`Service`, `ServiceInstance`, `ServiceTypeRegistry`) é compartilhado, mas as interfaces de visualização permanecem distintas:

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED SERVICE ENGINE                        │
│  ┌─────────────┐  ┌─────────────────┐  ┌───────────────────┐   │
│  │   Service    │  │ ServiceInstance  │  │ ServiceType       │   │
│  │  (janela)    │  │  (execução)      │  │ Registry          │   │
│  └──────┬───────┘  └────────┬─────────┘  └───────────────────┘   │
└─────────┼──────────────────┼────────────────────────────────────┘
          │                  │
    ┌─────┴─────┐      ┌─────┴──────┐
    │           │      │            │
    ▼           ▼      ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Agend.  │ │Agend.  │ │ Kanban │ │Kanban  │
│Slots   │ │Lista   │ │ Board  │ │Metrics │
│(grade) │ │(tabela)│ │(cards) │ │(dash)  │
└────────┘ └────────┘ └────────┘ └────────┘
  UI AGENDAMENTO        UI TAREFAS
```

### UI de Agendamentos (própria, não-Kanban)

A interface de agendamentos mantém sua visualização específica:

| Componente | Descrição |
|------------|-----------|
| `SlotsView` | Grade/calendário de slots disponíveis (substitui `admin/agendamentos/slots/[id]`) |
| `AgendamentosList` | Tabela de agendamentos com filtros por status, bairro, tipo (substitui `admin/agendamentos/page.tsx`) |
| `NovoAgendamentoForm` | Formulário dinâmico via `ServiceTypeRegistry` (substitui `agendamentos/novo/page.tsx`) |
| `AgendamentoDetail` | Detalhe de um agendamento com fotos, timeline, ações |
| `DispatchPanel` | Painel de despacho — seleciona agendamentos confirmados e cria Tasks no Kanban |

**Fluxo de agendamento:**
```
Cidadão vê slot → Cria agendamento → Operador confirma → Despacha para Kanban
     │                  │                    │                    │
     ▼                  ▼                    ▼                    ▼
  SlotsView      NovoAgendamentoForm   AgendamentosList    DispatchPanel
```

### UI de Tarefas (Kanban, inalterada)

A interface de tarefas permanece como está — Kanban Board com cards:

| Componente | Descrição |
|------------|-----------|
| `KanbanBoard` | Board com colunas (a_fazer, em_progresso, concluido) — inalterado |
| `KanbanTaskCard` | Card de tarefa — inalterado, mas pode exibir dados do `ServiceInstance` |
| `TaskDetailPage` | Detalhe da tarefa — pode renderizar formulário via `ServiceTypeRegistry` |
| `TaskMetrics` | Métricas — inalterado |

**Fluxo de tarefa:**
```
Operador cria task → Move no Kanban → Preenche formulário → Conclui
        │                  │                    │                │
        ▼                  ▼                    ▼                ▼
   KanbanBoard        KanbanTaskCard      TaskDetailPage    KanbanBoard
```

### Ponte: Despacho (Agendamento → Kanban)

O despacho é o ponto de convergência entre as duas UIs:

```typescript
// DispatchPanel: seleciona agendamentos confirmados e cria Tasks
async function handleDispatch(selectedAgendamentos: ServiceInstance[]) {
    for (const agendamento of selectedAgendamentos) {
        // Cria Task no Kanban
        await createTaskUseCase.execute({
            titulo: `[${agendamento.service.tipoId}] ${agendamento.clienteNome}`,
            descricao: agendamento.observacoes,
            demandaId: agendamento.demandaId,
            serviceInstanceId: agendamento.id,  // vincula ao ServiceInstance
            formRegistryId: agendamento.service.formRegistryId,
            dadosFormulario: agendamento.dadosFormulario,  // herda dados do form
            atribuidoPara: agendamento.atribuidoPara,
            prazo: agendamento.service.dataFim,
        });

        // Atualiza status do agendamento
        await updateServiceInstanceStatus(agendamento.id, 'despachado');
    }
}
```

### Integração com Kanban

Duas opções para conectar ServiceInstance ao Kanban:

**Opção A — ServiceInstance vinculado a Task (recomendada)**
- `tbl_tarefas` ganha coluna `service_instance_id` (FK)
- ServiceInstance é a fonte de verdade para dados do serviço
- Task é a projeção no Kanban
- Kanban lê de `tbl_tarefas` JOIN `tbl_service_instances`
- Mantém compatibilidade com todo o ecossistema existente (métricas, comentários, anexos)

**Opção B — Kanban lê ServiceInstance diretamente**
- Kanban lê de `tbl_service_instances` quando `service_id IS NOT NULL`
- Breaking change maior, mas elimina tabela intermediária

**Recomendação**: Opção A — menor risco, mantém compatibilidade.

### Mapeamento Kanban (ServiceInstance → Task)

```typescript
// Ao despachar, cria Task com dados enriquecidos
function toTaskFromServiceInstance(instance: ServiceInstance, service: Service): CreateTaskInput {
    return {
        titulo: `[${service.tipoId}] ${instance.clienteNome || 'Sem cliente'}`,
        descricao: service.descricao,
        demandaId: instance.demandaId,
        serviceInstanceId: instance.id,
        formRegistryId: service.formRegistryId,
        dadosFormulario: instance.dadosFormulario,
        prioridade: instance.prioridade,
        prazo: instance.prazo || service.dataFim,
        atribuidoPara: instance.atribuidoPara,
    };
}
```

---

## Migração de Dados

### Fase 1 — Schema (não destrutiva)

```sql
-- Nova tabela de serviços
CREATE TABLE IF NOT EXISTS tbl_services (
    id TEXT PRIMARY KEY,
    tipo_id TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio TEXT NOT NULL,
    data_fim TEXT NOT NULL,
    horario_inicio TEXT,
    horario_fim TEXT,
    capacidade INTEGER,
    bairros TEXT, -- JSON array
    local TEXT,
    form_registry_id TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho',
    criado_por TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT datetime('now'),
    atualizado_em TEXT NOT NULL DEFAULT datetime('now')
);

-- Nova tabela de instâncias
CREATE TABLE IF NOT EXISTS tbl_service_instances (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES tbl_services(id),
    cliente_id TEXT,
    atribuido_para TEXT,
    dados_formulario TEXT, -- JSON
    fotos_count INTEGER DEFAULT 0,
    prazo TEXT,
    prioridade TEXT DEFAULT 'media',
    ordem INTEGER,
    status TEXT NOT NULL DEFAULT 'pendente',
    motivo_cancelamento TEXT,
    criado_por TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT datetime('now'),
    atualizado_em TEXT NOT NULL DEFAULT datetime('now'),
    confirmado_por TEXT,
    confirmado_em TEXT,
    concluido_por TEXT,
    concluido_em TEXT
);

-- Vincular tarefas existentes a instâncias
ALTER TABLE tarefas ADD COLUMN service_instance_id TEXT;
```

### Fase 2 — Migração de dados existentes

```typescript
// Migrar agendamentos existentes
async function migrateAgendamentos(db: Database) {
    const slots = await db.select('SELECT * FROM tbl_agendamento_slots');

    for (const slot of slots) {
        // Criar Service
        await db.insert('tbl_services', {
            id: slot.id,
            tipo_id: slot.tipo_id,
            titulo: slot.titulo,
            data_inicio: slot.data_inicio,
            data_fim: slot.data_fim,
            // ...
        });

        // Migrar agendamentos → service_instances
        const agendamentos = await db.select(
            'SELECT * FROM tbl_agendamentos WHERE slot_id = ?', [slot.id]
        );

        for (const ag of agendamentos) {
            await db.insert('tbl_service_instances', {
                id: ag.id,
                service_id: slot.id,
                cliente_id: ag.cliente_id,
                dados_formulario: JSON.stringify({
                    bairro: ag.bairro,
                    tipos_residuo: ag.tipos_residuo,
                    volume_m3: ag.volume_m3,
                    vagas_solicitadas: ag.vagas_solicitadas,
                }),
                prazo: slot.data_fim,
                status: mapAgendamentoStatus(ag.status),
                // ...
            });
        }
    }
}

// Migrar tasks que são despachos de agendamento
async function migrateDispatchedTasks(db: Database) {
    const tasks = await db.select(
        `SELECT t.* FROM tarefas t
         JOIN tbl_agendamento_despachos d ON d.demanda_id = t.demanda_id
         WHERE d.agendamento_id IS NOT NULL`
    );

    for (const task of tasks) {
        await db.update('tarefas', {
            service_instance_id: task.demanda_id, // vincular
        });
    }
}
```

### Fase 3 — Depreciação (gradual)

- Manter `tbl_agendamento_slots` e `tbl_agendamentos` como views de leitura
- Novos agendamentos criados via `tbl_service_instances`
- UI migrada gradualmente (ADR-015 Plugin Registry aponta para ServiceTypeRegistry)

---

## Estrutura de Diretórios

```
desktop/src/domain/service/
├── Service.ts
├── ServiceInstance.ts
├── ServiceType.ts
├── ServiceStateMachine.ts
├── ServiceEvents.ts
├── ServiceRepository.ts
├── ServiceInstanceRepository.ts
└── validators/
    ├── ServiceValidator.ts
    ├── ServiceValidatorFactory.ts
    ├── MuseuValidator.ts          # migrado de agendamento
    ├── VolumososValidator.ts      # migrado de agendamento
    ├── EventoValidator.ts         # migrado de agendamento
    ├── RemocaoValidator.ts        # novo
    └── PodaValidator.ts           # novo

desktop/src/application/service/
├── CreateServiceUseCase.ts
├── PublishServiceUseCase.ts
├── CancelServiceUseCase.ts
├── CreateServiceInstanceUseCase.ts
├── ConfirmServiceInstanceUseCase.ts
├── CancelServiceInstanceUseCase.ts
├── ConcludeServiceInstanceUseCase.ts
├── ListServicesUseCase.ts
├── ListServiceInstancesUseCase.ts
└── DispatchServiceInstanceUseCase.ts  # ponte: ServiceInstance → Task

desktop/src/infrastructure/persistence/sqlite/
├── SqliteServiceRepository.ts
├── SqliteServiceInstanceRepository.ts
└── queries/service/
    ├── index.ts
    ├── service-queries.ts
    └── instance-queries.ts

desktop/src/infrastructure/container/modules/
└── ServiceContainerModule.ts

desktop/src/interface/hooks/
├── useServices.ts
├── useServiceInstances.ts
└── useServiceMutations.ts

desktop/components/service/
├── ServiceTypeRegistry.ts         # Registry de tipos (UI)
├── ServiceFormPlugin.tsx          # Plugin para formulário por tipo
├── ServiceInstanceCard.tsx        # Card para detalhe
└── ServiceFormSelector.tsx        # Seletor de formulário ao criar tipo

desktop/app/agendamentos/          # UI de agendamentos (PRÓPRIA)
├── page.tsx                       # Lista de agendamentos
├── slots/
│   └── [id]/page.tsx             # Detalhe do slot
├── novo/page.tsx                  # Novo agendamento (FormRenderer)
└── components/
    ├── SlotsView.tsx              # Grade de slots
    ├── AgendamentosList.tsx       # Tabela de agendamentos
    ├── AgendamentoDetail.tsx      # Detalhe
    ├── DispatchPanel.tsx          # Painel de despacho → Kanban
    └── ServiceTypeFormConfig.tsx  # Configuração de form por tipo

desktop/app/admin/service-types/   # Administração de tipos de serviço
├── page.tsx                       # Lista de tipos
├── novo/page.tsx                  # Criar novo tipo
├── [id]/page.tsx                  # Editar tipo
└── components/
    ├── ServiceTypeForm.tsx        # Formulário de criação/edição
    └── FormSelector.tsx           # Seletor de formulário do FormBuilder

desktop/app/tasks/                 # UI de tarefas (KANBAN, inalterada)
├── page.tsx                       # Kanban Board
└── components/
    ├── KanbanBoard.tsx
    ├── KanbanTaskCard.tsx
    └── TaskDetailPage.tsx
```

---

## Consequências

### Positivas

1. **Módulo de agendamento dinâmico** — tipos de serviço são criados via administração, não hardcoded
2. **FormBuilder para todos os tipos de serviço** — qualquer serviço pode criar seu formulário no formbuilder existente, com campos específicos para seu contexto
3. **Motor de datas único** — janelas de tempo + capacidade servem para agendamento cidadão e tarefas internas
4. **Validação por tipo expandida** — Strategy Pattern existente agora suporta tipos ilimitados via registry
5. **UI especializada por fluxo** — agendamentos mantêm interface própria (slots, lista); tarefas mantêm Kanban
6. **Elimina duplicação** — um domínio em vez de dois, uma state machine em vez de três
7. **Extensibilidade total** — adicionar novo tipo de serviço (ex: `capina_mecanica`) exige apenas criar formulário e registrar via admin
8. **Fotos unificadas** — qualquer serviço pode ter fotos com sync
9. **Despacho como ponte** — fluxo natural de agendamento → tarefa é explícito e rastreável
10. **Herança de formulários** — tipos podem herdar formulários de outros tipos, reduzindo duplicação
11. **Tipos podem ser desativados** — sem deletar dados existentes

### Negativas / Custos

1. **Migração de dados** — agendamentos e tasks existentes precisam ser migrados (~1 semana de scripts + validação)
2. **Breaking change** — todas as telas de agendamento precisam ser atualizadas
3. **Complexidade inicial** — novo domínio com mais abstrações que os atuais
4. **Risco de regressão** — fluxos existentes (despacho, recorrência, métricas) precisam ser revalidados
5. **Curva de aprendizado** — desenvolvedores precisam entender o novo modelo unificado
6. **UI de agendamentos precisa ser reescrita** — telas atuais usam `useSqlite` direto (ADR-014)

### Não Muda

- **Ouvidoria** (ADR-016) permanece domínio separado — não é afetada
- **Kanban UI** (`KanbanBoard`, `KanbanTaskCard`) permanece inalterada — visualização de tarefas continua igual
- **FormBuilder** permanece como está — qualquer tipo de serviço pode criar seu formulário
- **Demandas** continuam sendo criadas via despacho — o fluxo é generalizado
- **Métricas de tarefas** continuam funcionando — `tarefas` é a tabela canônica para o Kanban
- **UI de agendamentos** mantém visualização própria (slots, lista, formulário) — não vira Kanban

---

## Ordem de Execução Recomendada

```
FASE 1 — Domain Layer                              ~1 semana
├── Criar Service.ts, ServiceInstance.ts
├── Criar ServiceTypeRegistry.ts
├── Criar ServiceStateMachine.ts
├── Migrar validadores (Museu, Volumosos, Evento)
├── Criar novos validadores (Remocao, Poda)
└── Criar interfaces de repositório

FASE 2 — Infrastructure Layer                       ~1 semana
├── Criar tbl_services e tbl_service_instances
├── Criar SqliteServiceRepository
├── Criar SqliteServiceInstanceRepository
├── Criar queries centralizadas
├── Criar ServiceContainerModule
└── Registrar no DI container

FASE 3 — Application Layer                          ~3 dias
├── Criar use cases (Create, Publish, Cancel, CreateInstance, Confirm, ...)
├── Migrar despacho generalizado
├── Migrar AgendamentoFotoSync → ServiceFotoSync
└── Testes de use cases

FASE 4 — Migração de Dados                          ~3 dias
├── Script de migração agendamentos → services + service_instances
├── Script de vinculação tarefas → service_instances
├── Validação de dados migrados
└── Views de compatibilidade (tbl_agendamento_slots como view)

FASE 5 — Interface Layer                            ~1 semana
├── Migrar Plugin Registry (ADR-015) para ServiceTypeRegistry
├── Integrar FormRenderer com ServiceInstance
├── Migrar telas de agendamento (UI própria: slots, lista, formulário)
├── Adaptar DispatchPanel para criar Tasks via use cases
├── Kanban permanece inalterado (lê de tarefas)
└── Dashboard de agendamentos unificado

FASE 6 — Depreciação e Limpeza                      ~3 dias
├── Remover código legado de agendamento (domain/agendamento/)
├── Remover código legado de task duplicado
├── Atualizar documentação
└── Testes de regressão completos
```

**Estimativa total**: ~4 semanas de trabalho focado.

---

## Critérios de Aceitação

1. `grep -r 'tbl_agendamento_slots' desktop/src/` retorna **zero resultados** em código novo (apenas scripts de migração)
2. `grep -r 'tbl_agendamentos' desktop/src/` retorna **zero resultados** em código novo
3. Tipos de serviço são criados via administração (`/admin/service-types`), não hardcoded
4. Adicionar novo tipo de serviço (ex: `capina_mecanica`) exige **apenas** criar formulário no FormBuilder + registrar via admin
5. Formulário é renderizado dinamicamente baseado no `formRegistryId` do tipo de serviço
6. Qualquer tipo de serviço pode criar seu formulário no FormBuilder existente
7. UI de agendamentos mantém visualização própria (slots, lista, formulário)
8. Kanban Board permanece inalterado — lê de `tarefas`
9. Despacho cria Tasks no Kanban a partir de ServiceInstances confirmados
10. Migração preserva todos os dados existentes (agendamentos + tasks)
11. Todos os testes de regressão passam (museu, volumosos, evento, tarefas)
12. `grep -r 'useSqlite' components/ app/` retorna zero resultados (alinhado com ADR-014 Fase B)
