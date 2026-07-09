# Campo "Galeria de Evidências Fotográficas com Inconformidades" — Design

**Data:** 2026-07-09
**Status:** Aprovado (design) — pendente plano de implementação
**Módulo alvo:** `ecoforms/mobile` (Capacitor) e `ecoforms/desktop` (Tauri + Next.js) — fábrica de campos e motor de renderização de formulários
**Fora de escopo:** criação do módulo/formulário "Vistoria" em si (`tbl_module_registry`). Este design entrega apenas o tipo de campo reutilizável e o catálogo de apoio; o módulo "Vistoria" será montado depois pelo usuário no builder de módulos já existente, usando esse campo.

---

## 1. Objetivo e motivação

Hoje não existe, na fábrica de campos, um tipo que permita capturar **N fotos avulsas**, cada uma classificada com **uma ou mais inconformidades** de uma lista padrão, e submeter tudo junto no payload do formulário. O campo mais próximo que existe (`VistoriaChecklistField`/`VistoriaChecklistRenderer`) resolve um problema diferente: checklist fixo de itens pré-definidos, com status Conforme/Não Conforme por item.

Este design especifica um novo tipo de campo, `composite_gallery_collector`, para o caso de uso "coletor de evidências fotográficas livres com marcação de inconformidades", com paridade mobile (captura via câmera Capacitor) e desktop (upload de arquivo via Tauri/browser).

## 2. Decisões travadas (brainstorming 2026-07-09)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Escopo | Só o campo + catálogo de apoio. **Não** cria o módulo "Vistoria" nem mexe em `tbl_module_registry`. |
| 2 | Abordagem de implementação | Componente novo e isolado por plataforma (mobile: `GalleryInconformidadeField.js`; desktop: `GalleryInconformidadeRenderer.tsx`), seguindo o precedente do `VistoriaChecklistField`. Rejeitado: compor via `RepeatableGroupField` genérico (UX de câmera forçada + modal dedicada não cabe sem vazar lógica específica para um componente compartilhado por outras telas). |
| 3 | Nomenclatura das chaves de payload | Adaptadas às convenções internas do projeto, não ao schema literal colado pelo usuário (ver §4). |
| 4 | Formato de `inconformidades` | Array plano de ids (`["INC-001", "INC-004"]`), não array de objetos. Mais simples, alinhado ao precedente do `ChipsField`. Se surgir necessidade real de metadado por tag (severidade, notas), criar um **campo avançado separado** em vez de complicar este — não migrar in-place. |
| 5 | Armazenamento das fotos aninhadas | Base64 (`data:image/...;base64,...`), não `file://` URI nem `File` solto. Seguindo o precedente do `VistoriaChecklistField`/`VistoriaChecklistRenderer`, que já resolve fotos aninhadas em array assim — evita criar plumbing de upload nova para `File`s dentro de estruturas aninhadas (o pipeline atual só sabe subir `File` solto no topo do valor, via chave `.file`, como em `PhotoRenderer`/`GalleryRenderer`). |
| 6 | Catálogo de inconformidades | Reaproveita o mecanismo genérico existente — `registro_dados` com `tipo='inconformidades_padrao'`, consumido via `smartCache.loadDataSource()` (mobile) / hook de catálogo (desktop), administrado pela tela já existente `desktop/app/data-registry/page.tsx`. **Sem tabela dedicada nova** (ao contrário do padrão `tipos_residuo`/`tipos_intercorrencia`), porque o campo precisa do fluxo `dataSource` já usado por `ChipsField`/`RepeatableGroupField`, que só enxerga catálogos genéricos. |
| 7 | Campo "Observação" por foto | Incluído (opcional, texto livre), não fazia parte do schema original mas foi confirmado como necessário. |
| 8 | Severidade no catálogo | Não é atributo estruturado — fica embutida como texto no `label` (ex: `"Fiação exposta (Alta)"`). Catálogo permanece `{id, label, ativo}`. |
| 9 | Múltiplas fotos por sessão de marcação | Fila de fotos dentro da mesma abertura de modal: o fiscal acumula N fotos (tirando várias no mobile, ou selecionando várias de uma vez no desktop), marca inconformidades + observação **uma vez**, e ao salvar cada foto vira uma entrada separada no array — todas com as mesmas `inconformidades`/`observacao`, mas `id_foto`/`imagem`/`criado_em` próprios. Motivação: o fiscal pode ter mais de uma evidência fotográfica para a mesma inconformidade. |
| 10 | Limite de tamanho por foto | Configurável (`maxFileSizeKb`). Comportamento: **rejeita e avisa** no momento da captura/seleção, não tenta recomprimir automaticamente. |
| 11 | Exigir inconformidade por foto | **Não obrigatório** — o fiscal pode registrar evidência "conforme" sem nenhum apontamento. Só o campo como um todo é obrigatório (mínimo 1 foto), não cada foto ter tag. |

## 3. Registro do tipo de campo

**Mobile** (`mobile/www/js/fields/FieldFactory.js`):

```js
import GalleryInconformidadeField from './types/GalleryInconformidadeField.js';
// ...
const FIELD_TYPE_MAP = {
  // ...
  composite_gallery_collector: GalleryInconformidadeField,
  galeria_inconformidades: GalleryInconformidadeField, // alias
};
```

**Desktop** (`desktop/lib/form/field-type-map.ts` e `desktop/src/lib/field-type-map.ts` — os dois mapas existentes precisam ser conferidos e atualizados juntos) + `desktop/components/runtime/FormFieldRenderer.tsx` (dispatch para `GalleryInconformidadeRenderer`).

`normalizeFieldType` já faz lowercase/underscore, então `composite_gallery_collector` passa sem transformação adicional.

## 4. Config do campo (form schema)

```json
{
  "id": "bloco_fotos_vistoria",
  "type": "composite_gallery_collector",
  "label": "Evidências Fotográficas e Inconformidades",
  "required": true,
  "config": {
    "maxFiles": 20,
    "maxFileSizeKb": 5000,
    "allowGalleryUpload": false,
    "dataSource": "inconformidades_padrao"
  }
}
```

Diferenças em relação ao schema originalmente proposto: `max_files` → `maxFiles`, `allow_gallery_upload` → `allowGalleryUpload`, `source_options_datasource` (URL de API REST) → `dataSource` (chave de catálogo local), `maxFileSizeKb` adicionado. Isso segue a convenção camelCase já usada por `RepeatableGroupField`/`ChipsField`/`config.dataSource` no restante da fábrica, e substitui o conceito de endpoint REST (inexistente nesta arquitetura local-first) pelo mecanismo de catálogo já estabelecido.

`allowGalleryUpload:false` força câmera no mobile (`CameraSource.Camera`, sem `Prompt`). No desktop é efetivamente um no-op — não há distinção câmera-vs-galeria fora do mobile; o campo sempre usa seletor de arquivo (`<input type="file" accept="image/*">`), igual `PhotoRenderer`/`GalleryRenderer` hoje.

## 5. Payload / valor do campo

Valor armazenado é um **array plano** de evidências (mesmo padrão de valor array de `GalleryField`/`RepeatableGroupField`, não um objeto-envelope como `VistoriaChecklistField`):

```json
[
  {
    "id_foto": "0192f1a2-0000-7000-8000-000000000001",
    "imagem": "data:image/jpeg;base64,/9j/4AAQ...",
    "criado_em": "2026-07-09T15:00:00.000Z",
    "inconformidades": ["INC-001", "INC-004"],
    "observacao": ""
  }
]
```

- `id_foto`: `uuidv7()` de `ecoforms-core/utils` (convenção do projeto para novos IDs persistidos).
- `imagem`: base64 data URL (ver decisão #5).
- `criado_em`: ISO 8601, gerado no momento da captura.
- `inconformidades`: array plano de ids do catálogo (decisão #4).
- `observacao`: string, opcional, pode ser vazia.

`id_vistoria_local` e `data_auditoria` do schema original **não pertencem a este campo** — já vêm do envelope padrão de submissão do formulário (`submission = {formId, formTitle, data, submittedAt, userId}` em `form-renderer.js`, equivalente no desktop).

## 6. Catálogo `inconformidades_padrao`

- **Armazenamento**: `registro_dados` (`desktop/scripts/ensure-columns.ts`), `tipo='inconformidades_padrao'`, `conteudo={"id": "INC-001", "label": "...", "ativo": true}`. Seed idempotente (`INSERT OR IGNORE`), seguindo o padrão do bloco `mensagens_template` já existente (linha ~1802).
- **Seed inicial**: lista de exemplo (a ajustar depois via UI), inspirada no protótipo de referência: `INC-001 Fiação exposta (Alta)`, `INC-002 Piso quebrado (Média)`, `INC-003 Falta de EPI (Crítica)`, `INC-004 Iluminação deficiente (Baixa)`.
- **Administração**: tela já existente `desktop/app/data-registry/page.tsx` — sem UI nova a construir.
- **Consumo mobile**: `smartCache.loadDataSource('inconformidades_padrao')` → `shared/data_registry.json` filtrado por `tipo` — mesmo caminho de `ChipsField`/`RepeatableGroupField`.
- **Consumo desktop**: hook de catálogo já existente (`useDataRegistry`/`useFieldOptions`), mesmo `tipo`.

## 7. Fluxo de interação (mobile e desktop)

1. Botão **"Adicionar Registro Fotográfico"** abre modal (overlay no mobile; `Dialog` do shadcn no desktop).
2. **Fila de fotos** dentro da modal: mobile acumula via chamadas repetidas a `Camera.getPhoto({source: CameraSource.Camera})` (respeitando `allowGalleryUpload`); desktop usa `<input type="file" multiple accept="image/*">`. Cada arquivo é validado contra `maxFileSizeKb` no momento da entrada na fila — se exceder, rejeita e avisa, sem travar os demais.
3. Cada foto da fila é convertida para base64 (`FileReader.readAsDataURL`) e mostrada em preview all-together.
4. Abaixo da fila: checkboxes de `inconformidades_padrao` (via `dataSource`) + campo texto "Observação (opcional)" — preenchidos **uma vez** para toda a fila.
5. **Salvar**: cada foto da fila vira uma entrada independente no array do campo (`id_foto`/`imagem`/`criado_em` próprios; `inconformidades`/`observacao` replicados). Modal fecha, fila é limpa.
6. **Grade principal**: cards com thumbnail + badge `"N inconformidade(s)"` + ações excluir/editar (editar reabre modal com fila de 1 foto pré-carregada).
7. `maxFiles` desabilita "Adicionar" ao atingir o teto (aviso, não erro).

## 8. Validação

- Campo obrigatório (`required:true`): mínimo 1 foto no array total.
- Inconformidades por foto: **não obrigatório** (decisão #11) — evidência "conforme" é permitida.
- `maxFiles`: bloqueia novas capturas ao atingir o teto.
- `maxFileSizeKb`: rejeita arquivo individualmente na entrada da fila.

## 9. Integração com sync/persistência

Nenhuma mudança no pipeline de eventos: o campo viaja como parte do JSON opaco de `form_data` no evento `ecoforms.registro.criado`, gravado via `upsertRegistry` em `registro_dados`. Único ajuste necessário: adicionar `composite_gallery_collector` ao enum de `type` em `packages/core/src/sync/schemas/form-schema.json` (contrato compartilhado mobile/desktop) — sem isso, a validação de schema rejeita o campo.

## 10. Config do formBuilder (`FieldPropertiesPanel.tsx`)

Novo bloco condicional (`field.type === 'composite_gallery_collector'`), seguindo o padrão já usado para `vistoria_checklist` (linhas ~361-400): seletor de `dataSource`, input numérico `maxFiles` (default 20), input numérico `maxFileSizeKb` (default 5000), toggle `allowGalleryUpload` (com nota de que só afeta mobile).

## 11. Arquivos a criar/tocar

- `mobile/www/js/fields/types/GalleryInconformidadeField.js` (novo)
- `mobile/www/js/fields/FieldFactory.js` (registro do tipo)
- `mobile/www/css/fields/GalleryInconformidadeField.css` (novo, padrão de `VistoriaChecklistField.css`)
- `desktop/components/runtime/fields/GalleryInconformidadeRenderer.tsx` (novo)
- `desktop/components/runtime/FormFieldRenderer.tsx` (dispatch)
- `desktop/lib/form/field-type-map.ts` + `desktop/src/lib/field-type-map.ts` (confirmar por que existem dois mapas antes de editar ambos)
- `desktop/components/forms/FieldPropertiesPanel.tsx` (UI do builder)
- `desktop/scripts/ensure-columns.ts` (seed `registro_dados` tipo `inconformidades_padrao`)
- `packages/core/src/sync/schemas/form-schema.json` (enum do tipo de campo)
- `mobile/tests/gallery-inconformidade-field.test.js` (novo — não há testes unitários de campo individual hoje; primeiro do gênero, cobrindo fila, validação e `getSubmitData()`)

## 12. Testes

Não existem testes unitários de classes de campo individuais hoje (`mobile/tests/*.test.js` cobre `sync`/`data-service`, não `fields/types/*`). Este será o primeiro, cobrindo em isolamento (sem Capacitor real, mockado como já é feito em `CameraField`/`GalleryField`):
- fila acumula N fotos, respeita `maxFiles` e `maxFileSizeKb`;
- `getSubmitData()`/`getValue()` retorna o array no formato da §5;
- validação: bloqueia envio com 0 fotos quando `required:true`; não bloqueia foto sem inconformidade marcada.

Testes de integração do fluxo completo (captura → tag → submissão → evento `ecoforms.registro.criado` → `registro_dados`) ficam para quando o módulo "Vistoria" for de fato montado (fora do escopo deste design).
