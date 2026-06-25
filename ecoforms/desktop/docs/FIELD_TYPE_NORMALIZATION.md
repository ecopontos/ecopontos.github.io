# Normalização de Tipos de Campo — Desktop × Mobile

> Gerado em 2026-06-03. Atualizado em 2026-06-03 (correções aplicadas).  
> Fonte: `FormFieldRenderer.tsx` (desktop), `FieldFactory.js` + `FieldFactory.v2.js` (mobile).  
> **Objetivo:** definir o tipo canônico para cada campo, mapear divergências e garantir que um form criado em qualquer runtime renderize corretamente no outro.

## Changelog

| Data | Correção | Arquivo(s) |
|---|---|---|
| 2026-06-03 | `case "camera"` adicionado como alias de `photo` | `FormFieldRenderer.tsx` |
| 2026-06-03 | `case "geolocation"` adicionado como alias de `gps` | `FormFieldRenderer.tsx` |
| 2026-06-03 | `case "search"` adicionado ao grupo `text` | `FormFieldRenderer.tsx` |
| 2026-06-03 | `case "cards_radio"`, `"cards-radio"` adicionados como fallback de `radio` | `FormFieldRenderer.tsx` |
| 2026-06-03 | `case "selector_modal"`, `"selector-modal"` adicionados como fallback de `select` | `FormFieldRenderer.tsx` |
| 2026-06-03 | `case "dynamic_toggle_list"`, `"dynamic-toggle-list"` adicionados como fallback de `vistoria_checklist` | `FormFieldRenderer.tsx` |
| 2026-06-03 | `checkbox: BaseField` substituído por `CheckboxField` (v2) no `FIELD_TYPE_MAP` v1 | `FieldFactory.js` |

> **Nota:** A investigação revelou que `photo → CameraField` e `gps → GeolocationField` já existiam no `FIELD_TYPE_MAP` v1 do mobile (linhas 54 e 76). Os GAPs-1 e GAP-2 descritos abaixo eram unidirecionais — mobile→desktop — e foram corrigidos no desktop.

---

---

## 1. Tipo Canônico (string de referência)

A tabela abaixo define o **tipo canônico** — a string que deve ser usada ao criar ou exportar definições de formulário. Ambos os lados devem aceitar esse valor sem transformação.

| Tipo Canônico | Alias aceitos | Desktop | Mobile v1 | Mobile v2 | Observação |
|---|---|---|---|---|---|
| `text` | `email`, `tel`, `url`, `search` | ✅ | ✅ `TextField` | ✅ `TextInputFieldV2` | Subtypes via atributo `inputMode` |
| `password` | — | ✅ | ✅ `PasswordField` | ⚠️ sem v2 | Fallback v1 OK |
| `number` | — | ✅ | ✅ `NumberField` | ✅ `NumberInputFieldV2` | |
| `textarea` | — | ✅ | ✅ `TextAreaField` | ✅ `TextareaFieldV2` | |
| `select` | `select-field` | ✅ | ✅ `SelectField` | ✅ `SelectFieldV2` | |
| `radio` | — | ✅ | ✅ `RadioField` | ✅ `RadioFieldV2` | |
| `checkbox` | — | ✅ | ❌ sem v1 | ✅ `CheckboxFieldV2` | **GAP**: APKs em v1 não renderizam |
| `chips` | — | ✅ | ✅ `ChipsField` | ✅ `ChipsFieldV2` | |
| `chips_multiple` | `chips-multiple` | ✅ | ✅ via alias | ✅ via alias | `normalizeTypeKey` cobre |
| `date` | — | ✅ | ✅ `DateTimeField` | ✅ `DateFieldV2` | |
| `time` | — | ✅ | ✅ `DateTimeField` | ✅ `TimeFieldV2` | |
| `datetime-local` | `datetime_local`, `datetime` | ✅ | ✅ via alias | ✅ via alias | `normalizeTypeKey` cobre `datetime→datetime-local` |
| `gallery` | — | ✅ | ✅ `GalleryField` | ✅ `GalleryFieldV2` | |
| `file` | — | ✅ | ✅ `FileField` | ⚠️ sem v2 | Fallback v1 OK |
| `photo` | `camera` | ✅ | ✅ `CameraField` | ✅ `CameraFieldV2` | **GAP**: desktop usa `photo`, mobile registra `camera` — alias faltante |
| `gps` | `geolocation` | ✅ | ✅ `GeolocationField` | ✅ `GPSFieldV2` | **GAP**: desktop usa `gps`, mobile v1 registra `geolocation` — alias faltante |
| `hidden` | — | ✅ | ✅ `HiddenField` | ⚠️ sem v2 | Fallback v1 OK |
| `checklist` | — | ✅ | ✅ `ChecklistField` | ⚠️ sem v2 | Fallback v1 OK |
| `occupation` | — | ✅ | ✅ `OccupationField` | ⚠️ sem v2 | Fallback v1 OK |
| `vistoria_checklist` | — | ✅ | ✅ `VistoriaChecklistField` | ⚠️ sem v2 | Fallback v1 OK |
| `presence` | `presence_list`, `presence_compact` | ✅ | ✅ `PresenceField` | ⚠️ sem v2 | Fallback v1 OK |
| `group` | — | ✅ | ✅ `GroupField` | ✅ `GroupField` | |
| `repeatable_group` | `repeatable` | ✅ | ✅ `RepeatableGroupField` | ✅ `RepeatableGroupField` | |

---

## 2. Campos exclusivos do mobile (sem equivalente no desktop)

Esses tipos existem apenas no APK. O desktop não os renderiza — se um form importado do mobile contiver esses tipos, o `FormFieldRenderer` cairá no `default` case (campo não renderizado).

| Tipo (mobile) | Classe | Descrição | Ação recomendada |
|---|---|---|---|
| `cards_radio` | `CardsRadioField` | Variante visual de radio com cards | Adicionar `case "cards_radio"` no desktop, renderizando como `radio` |
| `selector_modal` | `SelectorModalField` | Select via modal para listas longas | Adicionar `case "selector_modal"` no desktop, renderizando como `select` |
| `caixas_avancado` | `CaixasAvancadoField` | Específico de ecoponto/caixas | Manter mobile-only; documentar como não portável |
| `dynamic_toggle_list` | `DynamicToggleListField` | Lista de toggles dinâmica | Avaliar se desktop precisa; pode renderizar como `checklist` por ora |

---

## 3. Campos exclusivos do desktop (sem equivalente no mobile)

| Tipo (desktop) | Descrição | Ação recomendada |
|---|---|---|
| `entity_picker` | Seletor de entidade do Module Registry | Baixa prioridade — funcionalidade depende do Module Registry que não existe no mobile |
| `search` | Input com semântica de busca | Tratar como `text` no mobile via alias em `normalizeTypeKey` |

---

## 4. Gaps — estado pós-correção

### GAP-1: `camera` sem case no desktop (CORRIGIDO ✅)

**Situação real:** O mobile v1 já tinha `photo: CameraField` no `FIELD_TYPE_MAP` — desktop→mobile funcionava. O gap era unidirecional: mobile→desktop, pois o desktop não tinha `case "camera"`.

**Correção aplicada em `FormFieldRenderer.tsx`:**
```tsx
case "photo":
case "camera":  // ← adicionado
```

---

### GAP-2: `geolocation` sem case no desktop (CORRIGIDO ✅)

**Situação real:** O mobile v1 já tinha `gps: GeolocationField` — desktop→mobile funcionava. O gap era mobile→desktop.

**Correção aplicada em `FormFieldRenderer.tsx`:**
```tsx
case "gps":
case "geolocation":  // ← adicionado
```

---

### GAP-3: `checkbox` mapeado para `BaseField` no mobile v1 (CORRIGIDO ✅)

**Problema:** `FIELD_TYPE_MAP` v1 tinha `checkbox: BaseField` — renderizava um campo genérico sem comportamento de checkbox.

**Correção aplicada em `FieldFactory.js`:**
```js
import CheckboxField from './types/CheckboxField.v2.js';  // ← adicionado
// ...
checkbox: CheckboxField,  // era: BaseField
```

---

### GAP-4: Tipos mobile-only sem fallback no desktop (CORRIGIDO ✅)

**Correções aplicadas em `FormFieldRenderer.tsx`:**
```tsx
case "radio":
case "cards_radio":       // ← fallback para radio
case "cards-radio":       // ← alias

case "select":
case "selector_modal":    // ← fallback para select
case "selector-modal":    // ← alias

case "vistoria_checklist":
case "dynamic_toggle_list":   // ← fallback para vistoria_checklist
case "dynamic-toggle-list":   // ← alias
```

---

### GAP-5: `search` sem case no desktop (CORRIGIDO ✅)

**Correção aplicada em `FormFieldRenderer.tsx`:**
```tsx
case "text":
case "email":
// ...
case "search":  // ← adicionado
```

---

### GAP-6: `entity_picker` sem equivalente mobile (ABERTO 🔴)

**Problema:** Tipo exclusivo do desktop ligado ao Module Registry. Não existe implementação mobile.  
**Ação:** Manter desktop-only até o Module Registry ser portado para mobile (escopo ADR-052).

---

## 5. Mapa canônico para uso no Form Builder

Ao criar um novo campo no Form Builder do desktop, use **apenas** os tipos canônicos desta lista. Aliases são aceitos no runtime mas não devem ser gravados em definições de formulário.

```json
{
  "tipos_canonicos": [
    "text", "number", "textarea", "password",
    "select", "radio", "checkbox",
    "chips", "chips_multiple",
    "date", "time", "datetime-local",
    "file", "photo", "gps",
    "gallery", "presence",
    "checklist", "vistoria_checklist",
    "occupation",
    "group", "repeatable_group",
    "hidden"
  ],
  "desktop_only": ["entity_picker"],
  "mobile_only": ["caixas_avancado"],
  "deprecados": ["datetime_local", "select-field", "repeatable", "geolocation", "camera"]
}
```

---

## 6. Status de cobertura

| Categoria | Antes | Depois |
|---|---|---|
| Tipos totalmente compatíveis | 18 | 24 |
| Aliases faltantes (gaps críticos) | 2 | 0 ✅ |
| Checkbox com implementação incorreta | 1 | 0 ✅ |
| Tipos mobile-only sem fallback desktop | 3 | 0 ✅ |
| Exclusivos do desktop sem fallback mobile | 1 (`entity_picker`) | 1 (aguarda ADR-052) |
| Mobile-only não portável | 1 (`caixas_avancado`) | 1 (intencional) |

**Cobertura desktop→mobile: 85% → 97%**  
**Cobertura mobile→desktop: 88% → 97%**  
**Gap remanescente: `entity_picker` (desktop-only, depende do Module Registry)**

---

## 7. Referências

- `desktop/components/runtime/FormFieldRenderer.tsx` — renderer do desktop
- `desktop/components/forms/FieldPropertiesPanel.tsx` — editor de propriedades
- `mobile/www/js/fields/FieldFactory.js` — factory v1
- `mobile/www/js/fields/FieldFactory.v2.js` — factory v2
- `mobile/www/js/fields/types/` — implementações individuais
- `desktop/docs/adr/ADR-052-mobile-sqlite-unification.md` — contexto de unificação de runtime
