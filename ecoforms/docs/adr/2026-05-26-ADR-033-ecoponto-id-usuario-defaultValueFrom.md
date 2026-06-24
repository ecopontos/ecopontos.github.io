# ADR-033: ecoponto_id no Perfil do Usuário e defaultValueFrom nos Formulários

**Data:** 2026-05-26  
**Status:**Implementado**
**Autores:** Equipe EcoForms

---

## Contexto

Os formulários `ecopontoCaixasForm` e `ecopontoForm` possuem um campo `ecoponto` que identifica em qual ecoponto a coleta ou atualização está sendo registrada. Atualmente esse campo é preenchido manualmente pelo operador ou carrega um `defaultValue` hardcoded (ex: `"ecoponto1"`).

Cada operador do perfil `operador` corresponde a exatamente um ecoponto: os usuários `ecoponto1`–`ecoponto9` operam exclusivamente no Ecoponto 1–9 respectivamente. A relação é 1:1 e imutável durante a sessão.

O problema: a plataforma não torna esse vínculo explícito. O `ecoponto_id` é inferível pelo `username` por convenção de nomenclatura, mas nenhuma camada o expõe como dado de primeiro nível. Isso obriga:

1. O operador a selecionar manualmente o ecoponto a cada uso
2. Os formulários a incluírem campo visível de seleção de ecoponto
3. O `_loadEcopontoState()` (ADR-032) a depender de `window.formData?.ecoponto` — que pode estar vazio no primeiro load

Além disso, o `defaultValue: "ecoponto1"` hardcoded no `ecopontoForm` é frágil: não funciona para os ecopontos 2–9 e não está alinhado com os valores do `ecoponto.json` (`"ecoponto_1"` com underscore).

---

## Decisão

**O `ecoponto_id` passa a ser atributo explícito do usuário, resolvido no login, e os campos de ecoponto nos formulários passam a usar `defaultValueFrom` para se auto-preencher sem interação do operador.**

A solução é composta por três camadas independentes que se reforçam:

### Camada 1 — Configuração do dispositivo: adicionar `ecoponto_id`

O `ecoponto_id` vive no `deviceConfig` do boot (não no perfil do usuário). Cada dispositivo/ecoponto recebe o campo `ecoponto_id` no `ecoforms_boot.json`:

```json
// deviceConfig no boot JSON
{
  "ecoponto_id": "ecoponto_1",
  "ecoponto_nome": "Ecoponto 1"
}
```

> **Nota:** A versão atual do código (`auth-manager.js`) lê `ecoponto_id` de `deviceConfig?.ecoponto_id`, não de `user.ecoponto_id`. O `ecoforms_boot.json` atual não possui `ecoponto_id` nos objetos de usuário.

### Camada 2 — Auth manager: expor `ecoponto_id` no objeto de sessão

`auth-manager.js` `loginLocal()` já inclui `ecoponto_id` no retorno (do `deviceConfig`):

```js
return {
    id: user.id,
    username: user.username,
    nome: user.nome,
    perfil: user.perfil,
    ecoponto_id: deviceConfig?.ecoponto_id || null,   // do deviceConfig, não do user
    ecoponto_nome: deviceConfig?.ecoponto_nome || null,
    escala: escala,
    setores: user.setores || [],
    formulariosPermitidos: user.formulariosPermitidos || [],
    loginAt: new Date().toISOString(),
    dataSource: dataSource
};
```

Isso torna `window.authManager.currentUser.ecoponto_id` disponível para qualquer parte do sistema sem inferência de username.

### Camada 3 — Formulários: `defaultValueFrom` e `hiddenForPerfil`

Os campos `ecoponto` nos formulários declaram:

```json
{
  "id": "ecoponto",
  "type": "text",
  "label": "Ecoponto",
  "defaultValueFrom": "currentUser.ecoponto_id",
  "hiddenForPerfil": ["operador"]
}
```

- **`defaultValueFrom`**: o renderer resolve o caminho `currentUser.ecoponto_id` via `_getUserContext()` e injeta o valor antes de renderizar o campo
- **`hiddenForPerfil`**: o renderer renderiza o campo como `<input type="hidden">` quando o `perfil` do usuário está na lista; gerentes e admins continuam vendo e editando o campo normalmente

Implementação em `generateFieldHTML()`:

```js
// form-renderer.js — generateFieldHTML()
let resolvedDefault = campo.defaultValue;

if (campo.defaultValueFrom) {
    const user = this._getUserContext();
    const path = campo.defaultValueFrom.replace('currentUser.', '');
    resolvedDefault = user?.[path] ?? campo.defaultValue ?? '';
}

const isHidden = Array.isArray(campo.hiddenForPerfil)
    && campo.hiddenForPerfil.includes(this._getUserContext()?.perfil);

if (isHidden) {
    return `<input type="hidden" id="${campo.id}" name="${campo.id}" value="${this.escapeHtml(resolvedDefault)}" />`;
}
```

---

## Impacto no `_loadEcopontoState()` (ADR-032)

Com `ecoponto_id` disponível no usuário, a carga inicial do estado salvo deixa de depender de `window.formData?.ecoponto`:

```js
// form-renderer.js — _loadEcopontoState()
const user = this._getUserContext();
const initialEcoponto = window.formData?.ecoponto || user?.ecoponto_id;
if (initialEcoponto) applyState(initialEcoponto);
```

Isso resolve o caso em que o form abre pela primeira vez sem nenhum valor em `window.formData`.

---

## Fluxo resultante

```
Operador ecoponto3 faz login
  → loginLocal() retorna { username: 'ecoponto3', ecoponto_id: 'ecoponto_3', perfil: 'operador', ... }
  → window.authManager.currentUser.ecoponto_id = 'ecoponto_3'

Operador abre ecopontoCaixasForm
  → generateFieldHTML(campo 'ecoponto')
      → defaultValueFrom: 'currentUser.ecoponto_id' → 'ecoponto_3'
      → hiddenForPerfil: ['operador'] → renderiza como <input type="hidden">
  → _loadEcopontoState()
      → initialEcoponto = user.ecoponto_id = 'ecoponto_3'
      → getEcopontoEstado('ecoponto_ocupacao_ecoponto_3')
      → OccupationField restaurado com estado salvo

Operador salva — campo ecoponto = 'ecoponto_3' via hidden input
  → saveEcopontoCaixasIncremental({ data: { ecoponto: 'ecoponto_3', ... } })
  → storeKey = 'ecoponto_ocupacao_ecoponto_3'

Gerente abre ecopontoCaixasForm
  → campo ecoponto renderizado normalmente (visível, editável)
  → pode selecionar qualquer ecoponto para inspecionar ou corrigir
```

---

## Alternativas consideradas

### Auto-injeção em `DataService.saveFormData()` (Opção B — descartada)

Derivar o ecoponto do `username` dentro do `saveFormData()` antes de persistir. Descartada porque:
- A lógica fica enterrada na camada de dados, invisível ao formulário
- A UI continua mostrando o campo em branco para o operador (problema de UX não resolvido)
- Depende de convenção de nomenclatura de `username` — frágil se usuários forem renomeados
- Não generaliza: outros campos que precisem de contexto do usuário precisariam de lógica análoga

### Derivação no `loginLocal()` sem `ecoponto_id` no JSON (Opção C — parcial)

Derivar `ecoponto_id` dinamicamente de `username` dentro do `auth-manager` sem alterar o boot JSON. Descartada como solução completa porque:
- A relação username → ecoponto_id permanece implícita e quebraria silenciosamente se o username mudar
- Para usuários migrados de outro sistema, o username pode não seguir o padrão `ecopontoN`
- A Camada 1 (dado explícito no perfil) tem custo baixo e elimina a dependência da convenção

### Campo `readonly` em vez de `hidden` para operadores

Manter o campo visível mas não editável para operadores, como confirmação visual de qual ecoponto está sendo operado. Pode ser adotado como variação: substituir `hiddenForPerfil` por `readonlyForPerfil`. Decisão adiada — depende de feedback dos operadores em campo.

---

## Consequências

### Positivas

- Operador nunca precisa selecionar ou ver o campo ecoponto
- `ecoponto_id` é dado explícito e auditável no perfil do usuário
- `defaultValueFrom` e `hiddenForPerfil` são mecanismos genéricos — qualquer campo em qualquer form pode reutilizá-los sem código adicional
- `_loadEcopontoState()` (ADR-032) funciona corretamente no primeiro load, sem depender de interação prévia
- Gerentes e admins preservam visibilidade e controle do campo

### Negativas / Riscos

- **Boot JSON dos 9 operadores precisa ser atualizado**: adição de `ecoponto_id` é necessária para cada usuário. Se o boot for re-provisionado sem o campo, o comportamento degrada para campo em branco (não quebra, mas o operador precisaria selecionar manualmente)
- **Consistência do valor**: `ecoponto_id` deve usar o mesmo formato do datasource (`ecoponto_N` com underscore). Um valor inconsistente (ex: `ecoponto1` sem underscore) faria a carga do estado falhar silenciosamente. Mitigado pela validação no boot e pelo fallback da Camada 3 (`campo.defaultValue` como fallback de `defaultValueFrom`)
- **Usuários sem `ecoponto_id`**: `gerente` e `admin` não têm o campo — o renderer já trata isso com `?? campo.defaultValue ?? ''`, portanto `defaultValueFrom` retorna vazio e o campo fica em branco para seleção normal

### Sem mudança

- Pipeline de eventos e persistência incremental — intacto
- `FormSyncService`, `TarefasSyncService`, `InboundService` — intacto
- Comportamento de todos os outros formulários — intacto
- Lógica de autenticação, bcrypt, `sal_sync` — intacto

---

## Plano de implementação

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `ecoforms_boot.json` | Adicionar `ecoponto_id` e `ecoponto_nome` no objeto `boot` |
| 2 | `ecoforms_boot.json` | Campo `ecoponto` em `ecopontoCaixasForm` e `ecopontoForm`: adicionar `defaultValueFrom` e `hiddenForPerfil` |
| 3 | `auth-manager.js` | `loginLocal()`: `ecoponto_id` já vem de `deviceConfig` — implementado |
| 4 | `form-renderer.js` | `generateFieldHTML()`: implementar `defaultValueFrom` e `hiddenForPerfil` ✅ |
| 5 | `form-renderer.js` | `_loadEcopontoState()`: implementar restauração de estado usando `user.ecoponto_id` como fallback ✅ |

Passos 1–2 são dados; passos 3–5 são código. Nenhuma migração de dados existentes é necessária: registros já salvos com `ecoponto` derivado do formulário continuam válidos.

---

## Referências

- `mobile_standalone/ecoforms_boot.json` — definição de usuários e formulários
- `mobile_standalone/www/js/auth-manager.js` — `loginLocal()`, `getCurrentUser()`
- `mobile_standalone/www/js/form-renderer.js` — `generateFieldHTML()`, `_getUserContext()`, `_loadEcopontoState()`
- `mobile_standalone/www/js/fields/defaults.js` — `computeDefaultValue()` (padrão análogo para `defaultToNow`)
- `ADR-032` — estado persistente no ecopontoCaixasForm (`_loadEcopontoState`)
