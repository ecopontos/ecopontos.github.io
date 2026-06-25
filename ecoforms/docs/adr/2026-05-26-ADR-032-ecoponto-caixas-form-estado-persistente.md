# ADR-032: Estado Persistente no ecopontoCaixasForm

**Data:** 2026-05-26  
**Status:**Implementado**
**Autores:** Equipe EcoForms

---

## Contexto

O `ecopontoCaixasForm` registra o nível de ocupação das 7 caixas de um ecoponto (Entulho, Madeira, Poda, Reciclável, Rejeito, Sucata, Vidro). Diferente dos demais formulários da plataforma — que coletam eventos novos a cada envio — este formulário representa **estado atual**, não ocorrência.

O comportamento padrão do `form-renderer.js` após um envio bem-sucedido é:

1. Chamar `form.reset()` — limpa todos os campos do DOM
2. Limpar `window.formData` para cada campo do formulário
3. Disparar o evento `form-reset`

Isso forçava o operador a reinserir do zero os níveis de todas as caixas a cada atualização, mesmo que apenas uma caixa tivesse mudado. Além disso, ao reabrir o formulário a UI não refletia o estado real das caixas — o operador não sabia o que estava registrado antes de editar.

O pipeline de persistência incremental (`DataService.saveEcopontoCaixasIncremental`) já consolidava os eventos por ecoponto num registro-chave `ecoponto_ocupacao_${ecopontoId}` no IndexedDB. O dado estava salvo corretamente; o problema era exclusivamente na camada de UI.

---

## Decisão

**O `ecopontoCaixasForm` não limpa o estado após envio e carrega o último estado salvo ao abrir.**

Duas mudanças pontuais em `form-renderer.js`:

### 1. Skip do reset pós-submit

O bloco de limpeza de formulário é condicional:

```js
// form-renderer.js — handleFormSubmit()
if (formConfig.id !== 'ecopontoCaixasForm') {
    form.reset();
    // ... limpa window.formData e dispara form-reset ...
}
```

O estado das caixas permanece visível após o envio. O operador vê o estado atualizado imediatamente e pode continuar editando sem precisar reabrir o formulário.

### 2. Restauração do estado ao abrir — `_loadEcopontoState()`

Chamado ao final de `applyFormHandlers()` quando `formConfig.id === 'ecopontoCaixasForm'`:

```js
// form-renderer.js — _loadEcopontoState(formConfig)
const estado = await dataService.getEcopontoEstado(`ecoponto_ocupacao_${ecopontoId}`);
if (estado?.ocupacao) {
    instance.setValue(
        { ocupacao: estado.ocupacao, removidas: {} },
        { silent: true, reason: 'database_sync_update' }
    );
    instance.refreshDom();
}
```

> **Nota de implementação:** O estado consolidado no IndexedDB não possui campo `removidas` separado — a remoção é representada pela ausência da caixa em `ocupacao`.

- **Carga inicial**: usa `window.formData?.ecoponto` para derivar a chave
- **Reativo**: escuta `change`/`input` no campo `ecoponto` e recarrega o estado ao trocar de ecoponto

A injeção usa `setValue()` com `{ silent: true, reason: 'database_sync_update' }` para não gerar eventos de mudança nem criar novo `incrementalEvento` durante a restauração.

---

## Fluxo resultante

```
Operador abre ecopontoCaixasForm
  → applyFormHandlers()
  → _loadEcopontoState()
      → getEcopontoEstado('ecoponto_ocupacao_ecoponto_1')
      → OccupationField.setValue({ ocupacao: {1:'75', 2:'50', ...} }, { silent })
      → OccupationField.refreshDom()
      → UI exibe o estado real das caixas

Operador atualiza uma caixa e clica em Salvar
  → saveEcopontoCaixasIncremental()
      → upsert do estado consolidado em IndexedDB
      → incrementalEvento adicionado ao histórico
      → syncStatus = 'pending' → pipeline de eventos
  → form NÃO é resetado
  → UI permanece com o estado atualizado visível
```

---

## Alternativas consideradas

### Flag no JSON do formulário (`"clearAfterSubmit": false`)

Adicionar `"clearAfterSubmit": false` e `"loadLastRecord": true` ao `ecopontoCaixasForm.json` no boot. O renderer leria essas flags de forma genérica, tornando o comportamento configurável por formulário sem alterar código.

**Descartada** neste ciclo porque:
- O `form-renderer.js` não tem arquitetura de plugins de ciclo de vida — a flag exigiria refatoração mais ampla
- Apenas um formulário precisa deste comportamento hoje
- A abordagem via `formConfig.id === 'ecopontoCaixasForm'` é cirúrgica e não afeta nenhum outro formulário
- Pode ser generalizada via flag em iteração futura (ver Consequências)

### Query explícita no HTML da página

Adicionar lógica de carregamento diretamente nas páginas que hospedam o formulário (e.g., `app.js`). Descartada porque fragmenta responsabilidade: o renderer já controla o ciclo de vida do formulário e é o lugar correto para essa lógica.

---

## Consequências

### Positivas

- Operadores veem o estado atual das caixas ao abrir o formulário — reduz erros de atualização
- Não é necessário redigitar todos os 7 níveis a cada visita ao ecoponto
- Nenhum outro formulário é afetado — `form.reset()` continua para todos os demais

### Negativas / Riscos

- **Estado desatualizado em troca de operador**: se dois operadores usam o mesmo device e trocam de usuário sem recarregar, o estado exibido pertence ao ecoponto carregado anteriormente. Mitigado porque cada device é atribuído a um operador/ecoponto específico.
- **Primeiro acesso sem histórico**: se nenhum envio anterior existir para aquele `ecopontoId`, o formulário abre em branco normalmente — comportamento correto.
- **Acoplamento por `formConfig.id`**: a condição `=== 'ecopontoCaixasForm'` é hardcoded. Em caso de renomeação do formulário no boot JSON, a condição precisa ser atualizada manualmente. Candidato a migração para flag no JSON quando houver um segundo formulário com o mesmo requisito.

### Sem mudança

- Pipeline de eventos e persistência incremental (`saveEcopontoCaixasIncremental`) — intacto
- Sync com Supabase Storage (`TarefasSyncService`, `InboundService`) — intacto
- Comportamento de todos os demais formulários — intacto
- `FormStore` / `DataService.cleanupSynced()` — intacto

---

## Referências

- `mobile_standalone/www/js/form-renderer.js` — `handleFormSubmit()`, `applyFormHandlers()`, `_loadEcopontoState()`
- `mobile_standalone/www/js/data-service.js` — `saveEcopontoCaixasIncremental()`, `getEcopontoEstado()`
- `mobile_standalone/www/js/fields/types/OccupationField.js` — `setValue()`, `refreshDom()`
- `mobile_standalone/ecoforms_boot.json` — definição do `ecopontoCaixasForm`
- `ADR-023` — implementação RBAC (contexto de usuários por ecoponto)
- `ADR-031` — fetch de dados persistentes via LAN (padrão de estado vs. evento)
