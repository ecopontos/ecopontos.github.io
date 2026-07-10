# Campo "Galeria de Evidências Fotográficas com Inconformidades" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new reusable form field type, `composite_gallery_collector`, that lets a user capture N photos, tag each with zero or more "inconformidades" from a catalog, and submit them together — implemented on both mobile (Capacitor) and desktop (Tauri + Next.js).

**Architecture:** Two isolated field components (mobile: `GalleryInconformidadeField.js` extending `BaseField`; desktop: `GalleryInconformidadeRenderer.tsx` controlled React component), each following the existing `VistoriaChecklistField`/`VistoriaChecklistRenderer` precedent for nested base64 photos. Both read/write the same JSON array shape and consume the same generic `registro_dados` catalog (`tipo='inconformidades_padrao'`) that already powers `ChipsField`/`ChipsRenderer`. No changes to the sync/event pipeline — both platforms ride their existing, separate persistence rails (mobile: `ecoforms.registro.criado` event; desktop: "pacote v2" via `insertPacoteFromForm`).

**Tech Stack:** Mobile — vanilla ES modules, Alpine.js, Capacitor Camera plugin, Vitest + happy-dom. Desktop — Next.js, React, TypeScript, shadcn/ui (`Dialog`, `Badge`, `Button`, `Textarea`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-09-galeria-inconformidades-design.md`

## Global Constraints

- New persisted IDs use UUID v7 (`id_foto`) — mobile imports `uuidv7` from `/js/ecoforms-core.js`; desktop imports from `ecoforms-core` where already established, but this field's own local queue IDs use a simple local-id generator (not persisted).
- `dataSource` lives at the **root** of the field JSON (`field.dataSource`), never inside `field.config` — desktop's `getRegistrySource()` only reads the root property.
- Nested photos are stored as base64 data URLs (`imagem` key), never `File` objects or `file://` URIs — required for cross-platform payload consistency (see spec §2 decision 5).
- `inconformidades` is a flat array of catalog ids (`["INC-001", "INC-004"]`), never an array of objects.
- Catalog entries with `ativo === false` must be filtered out client-side by this field's own code — neither `ChipsRenderer`, `useDataRegistryAggregated`, nor the mobile `smartCache` path do this automatically.
- Per-photo `inconformidades` is never required, even when the field itself is `required:true` (only "at least 1 photo" is enforced).
- Out of scope: creating the "Vistoria" module/form itself, `tbl_module_registry` changes, and any new sync/event code.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/sync/schemas/form-schema.json` | Adds `composite_gallery_collector` to the canonical `type` enum |
| `packages/core/src/sync/schemas/form-schema-validator.ts` | Adds the same type to `FormFieldType` union + `VALID_FIELD_TYPES` |
| `packages/core/src/sync/__tests__/form-schema-validator.test.ts` | Guards the two above stay in sync |
| `desktop/scripts/ensure-columns.ts` | Seeds `registro_dados` catalog `inconformidades_padrao` |
| `mobile/www/js/fields/types/GalleryInconformidadeField.js` | Mobile field class: queue, catalog loading, validation, render |
| `mobile/tests/gallery-inconformidade-field.test.js` | Unit tests for the mobile field's pure logic |
| `mobile/www/js/fields/FieldFactory.js` | Registers the new type |
| `mobile/www/css/fields/GalleryInconformidadeField.css` | Tailwind utility shim for classes not already covered |
| `mobile/www/index.html` | Links the new CSS file |
| `desktop/src/lib/gallery-inconformidade.ts` | Pure, testable helper: turns a photo queue + tags into array entries |
| `desktop/src/lib/__tests__/gallery-inconformidade.test.ts` | Unit test for the helper above |
| `desktop/components/runtime/fields/GalleryInconformidadeRenderer.tsx` | Desktop controlled component (queue modal + gallery grid) |
| `desktop/components/runtime/FormFieldRenderer.tsx` | Dispatch case + value coercion helpers |
| `desktop/components/runtime/FormRenderer.tsx` | Adds the type to `fullWidthTypes` |
| `desktop/components/forms/FieldPropertiesPanel.tsx` | Builder UI: type option + config block (maxFiles/maxFileSizeKb/allowGalleryUpload) |

`desktop/lib/form/field-type-map.ts` and `desktop/src/lib/field-type-map.ts` need **no edit** — `composite_gallery_collector` is already snake_case and isn't one of the four remapped aliases, so `normalizeFieldType`'s `default` branch already returns it unchanged. Task 5 includes a verification step for this instead of a code change.

---

### Task 1: Shared field-type contract

**Files:**
- Modify: `packages/core/src/sync/schemas/form-schema.json`
- Modify: `packages/core/src/sync/schemas/form-schema-validator.ts`
- Test: `packages/core/src/sync/__tests__/form-schema-validator.test.ts` (new)

**Interfaces:**
- Produces: `isValidFieldType('composite_gallery_collector') === true`, used by every later task that registers the field type on either platform.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/sync/__tests__/form-schema-validator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isValidFieldType, normalizeFieldType, type FormFieldType } from '../schemas/form-schema-validator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('form-schema-validator', () => {
    it('reconhece composite_gallery_collector como tipo válido', () => {
        expect(isValidFieldType('composite_gallery_collector')).toBe(true);
    });

    it('não remapeia composite_gallery_collector para outro tipo', () => {
        expect(normalizeFieldType('composite_gallery_collector')).toBe('composite_gallery_collector');
    });

    it('mantém form-schema.json e VALID_FIELD_TYPES em sincronia', () => {
        const schemaPath = path.resolve(__dirname, '../schemas/form-schema.json');
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        const jsonEnum: string[] = schema.$defs.field.properties.type.enum;

        expect(jsonEnum).toContain('composite_gallery_collector');
        jsonEnum.forEach((type) => {
            expect(isValidFieldType(type)).toBe(true);
        });
    });

    it('tipo FormFieldType aceita composite_gallery_collector em tempo de compilação', () => {
        const t: FormFieldType = 'composite_gallery_collector';
        expect(t).toBe('composite_gallery_collector');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/sync/__tests__/form-schema-validator.test.ts`
Expected: FAIL — `isValidFieldType('composite_gallery_collector')` returns `false`, and the TS compile step for the last test fails because `'composite_gallery_collector'` isn't assignable to `FormFieldType`.

- [ ] **Step 3: Add the type to the JSON schema enum**

In `packages/core/src/sync/schemas/form-schema.json`, inside `$defs.field.properties.type.enum`, add the new entry after `"caixas-avancado"`:

```json
            "occupation-selector",
            "selector-modal",
            "cards-radio",
            "caixas-avancado",
            "composite_gallery_collector"
          ]
```

- [ ] **Step 4: Add the type to the TS validator**

In `packages/core/src/sync/schemas/form-schema-validator.ts`, extend the union (line ~9-16):

```ts
export type FormFieldType =
    | "text" | "textarea" | "number" | "email" | "tel" | "url" | "password"
    | "date" | "time" | "datetime"
    | "select" | "radio" | "checkbox" | "chips"
    | "file" | "camera" | "photo" | "signature" | "location"
    | "hidden" | "group" | "repeatable-group"
    | "presence" | "checklist" | "vistoria_checklist"
    | "occupation-selector" | "selector-modal" | "cards-radio" | "caixas-avancado"
    | "composite_gallery_collector";
```

And `VALID_FIELD_TYPES` (line ~54-62):

```ts
const VALID_FIELD_TYPES = new Set<string>([
    "text", "textarea", "number", "email", "tel", "url", "password",
    "date", "time", "datetime",
    "select", "radio", "checkbox", "chips",
    "file", "camera", "photo", "signature", "location",
    "hidden", "group", "repeatable-group",
    "presence", "checklist", "vistoria_checklist",
    "occupation-selector", "selector-modal", "cards-radio", "caixas-avancado",
    "composite_gallery_collector",
]);
```

Do **not** add `composite_gallery_collector` to `TYPE_ALIASES` — it is the canonical type, not an alias of another one.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/sync/__tests__/form-schema-validator.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/sync/schemas/form-schema.json packages/core/src/sync/schemas/form-schema-validator.ts packages/core/src/sync/__tests__/form-schema-validator.test.ts
git commit -m "feat: add composite_gallery_collector to shared form field type contract"
```

---

### Task 2: Catalog seed — `inconformidades_padrao`

**Files:**
- Modify: `desktop/scripts/ensure-columns.ts`

**Interfaces:**
- Produces: rows in `registro_dados` with `tipo='inconformidades_padrao'`, `conteudo={"id":..., "label":..., "ativo":true}` — consumed by Task 3 (mobile) and Task 5 (desktop) via `dataSource: "inconformidades_padrao"`.

- [ ] **Step 1: Add the seed block**

In `desktop/scripts/ensure-columns.ts`, right after the existing `registro_dados` seed block (the one inserting `ouv-msg-1`/`ouv-msg-2`, around line 1801-1806), add:

```ts
    try {
        const c = await query<{ n: number }>(`SELECT COUNT(*) as n FROM registro_dados WHERE tipo = 'inconformidades_padrao'`);
        if (c[0]?.n === 0) {
            await execute(`INSERT OR IGNORE INTO registro_dados (id, tipo, chave, conteudo) VALUES
                ('inc-001', 'inconformidades_padrao', 'INC-001', '{"id":"INC-001","label":"Fiação exposta (Alta)","ativo":true}'),
                ('inc-002', 'inconformidades_padrao', 'INC-002', '{"id":"INC-002","label":"Piso quebrado (Média)","ativo":true}'),
                ('inc-003', 'inconformidades_padrao', 'INC-003', '{"id":"INC-003","label":"Falta de EPI (Crítica)","ativo":true}'),
                ('inc-004', 'inconformidades_padrao', 'INC-004', '{"id":"INC-004","label":"Iluminação deficiente (Baixa)","ativo":true}'),
                ('inc-005', 'inconformidades_padrao', 'INC-005', '{"id":"INC-005","label":"Sinalização ausente (Média)","ativo":true}')
            `);
            console.log('[Seed] inconformidades_padrao OK');
        }
    } catch (e) { console.warn('[Seed] inconformidades_padrao:', e); }
```

- [ ] **Step 2: Run the script and verify the rows exist**

Run: `cd desktop && npx ts-node scripts/ensure-columns.ts`
Expected: console output includes `[Seed] inconformidades_padrao OK` on first run (or silently skips on subsequent runs because the guard count is no longer 0).

- [ ] **Step 3: Query the local SQLite DB to confirm**

Run (adjust the DB path to match your local Tauri app data dir — check `desktop/src-tauri/tauri.conf.json` or the app's data directory printed at boot if unsure):

```bash
cd desktop && npx ts-node -e "
import { query } from './src-tauri-shim-or-whatever-the-project-uses';
" 2>/dev/null || echo "Fallback: open the DB with a SQLite browser and run: SELECT * FROM registro_dados WHERE tipo='inconformidades_padrao';"
```

Expected: 5 rows returned, each `conteudo` parseable as JSON with `id`/`label`/`ativo` keys. (If there's no convenient one-off query script in this repo, verify instead through the already-existing `/data-registry` admin page in Task 7's manual verification — this step's SQL check is optional if that page confirms the rows.)

- [ ] **Step 4: Commit**

```bash
git add desktop/scripts/ensure-columns.ts
git commit -m "feat: seed inconformidades_padrao catalog for composite_gallery_collector field"
```

---

### Task 3: Mobile field — core logic (TDD)

**Files:**
- Create: `mobile/www/js/fields/types/GalleryInconformidadeField.js`
- Test: `mobile/tests/gallery-inconformidade-field.test.js` (new)

**Interfaces:**
- Consumes: `BaseField` (`./BaseField.js`) — constructor hoists `config.config.*` to `this.config.*` automatically, `this.value` defaults per `getDefaultValue()`, `getValue()`/`validate()` are inherited unmodified (no override needed — `this.value` is already the array `getValue()` should return, and BaseField's `required` validator already treats an empty array as invalid).
- Consumes: `uuidv7` from `/js/ecoforms-core.js` (same import path as `mobile/www/js/sync/InboundService.js`).
- Produces (for Task 4 and later manual verification): `field.getValue()` → `Array<{id_foto, imagem, criado_em, inconformidades, observacao}>`; instance methods `abrirModal()`, `fecharModal()`, `tirarFoto()`, `escolherDaGaleria()`, `_adicionarFotoAFila(base64DataUrl)`, `removerDaFila(localId)`, `toggleInconformidade(id)`, `setObservacao(texto)`, `podeAdicionarMais()`, `salvarEvidencias()`, `editarEvidencia(idFoto)`, `removerEvidencia(idFoto)`, `carregarInconformidades()`; fields `this.filaFotos`, `this.inconformidadesSelecionadas`, `this.observacaoAtual`, `this.modalAberta`, `this.inconformidadesOptions`, `this.maxFiles`, `this.maxFileSizeKb`, `this.allowGalleryUpload`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/tests/gallery-inconformidade-field.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import GalleryInconformidadeField from '../www/js/fields/types/GalleryInconformidadeField.js';

function makeField(overrides = {}) {
    return new GalleryInconformidadeField({
        id: 'bloco_fotos_vistoria',
        label: 'Evidências Fotográficas',
        type: 'composite_gallery_collector',
        dataSource: 'inconformidades_padrao',
        ...overrides,
    });
}

function makeBase64(byteLength) {
    const raw = 'A'.repeat(Math.ceil(byteLength / 3) * 4);
    return `data:image/jpeg;base64,${raw}`;
}

describe('GalleryInconformidadeField', () => {
    beforeEach(() => {
        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);
        window.fieldInstances = {};
        window.smartCache = undefined;
    });

    it('inicia com value como array vazio quando nenhum valor é passado', () => {
        const field = makeField();
        expect(field.getValue()).toEqual([]);
    });

    it('_adicionarFotoAFila adiciona foto dentro do limite de tamanho', () => {
        const field = makeField({ maxFileSizeKb: 5000 });
        const ok = field._adicionarFotoAFila(makeBase64(1000));
        expect(ok).toBe(true);
        expect(field.filaFotos).toHaveLength(1);
        expect(window.alert).not.toHaveBeenCalled();
    });

    it('_adicionarFotoAFila rejeita foto que excede maxFileSizeKb', () => {
        const field = makeField({ maxFileSizeKb: 1 });
        const ok = field._adicionarFotoAFila(makeBase64(5000));
        expect(ok).toBe(false);
        expect(field.filaFotos).toHaveLength(0);
        expect(window.alert).toHaveBeenCalledTimes(1);
    });

    it('salvarEvidencias cria uma entrada por foto na fila, todas com as mesmas inconformidades e observação', () => {
        const field = makeField();
        field._adicionarFotoAFila(makeBase64(100));
        field._adicionarFotoAFila(makeBase64(100));
        field.toggleInconformidade('INC-001');
        field.toggleInconformidade('INC-004');
        field.setObservacao('Duas evidências da mesma falha');

        const ok = field.salvarEvidencias();

        expect(ok).toBe(true);
        expect(field.getValue()).toHaveLength(2);
        field.getValue().forEach((entry) => {
            expect(entry.inconformidades).toEqual(['INC-001', 'INC-004']);
            expect(entry.observacao).toBe('Duas evidências da mesma falha');
            expect(entry.id_foto).toBeTruthy();
            expect(entry.criado_em).toBeTruthy();
        });
        const ids = field.getValue().map((e) => e.id_foto);
        expect(new Set(ids).size).toBe(2);
        expect(field.modalAberta).toBe(false);
        expect(field.filaFotos).toHaveLength(0);
    });

    it('salvarEvidencias não faz nada quando a fila está vazia', () => {
        const field = makeField();
        const ok = field.salvarEvidencias();
        expect(ok).toBe(false);
        expect(field.getValue()).toHaveLength(0);
        expect(window.alert).toHaveBeenCalledTimes(1);
    });

    it('salvarEvidencias respeita maxFiles', () => {
        const field = makeField({ maxFiles: 1 });
        field._adicionarFotoAFila(makeBase64(100));
        field.salvarEvidencias();
        expect(field.getValue()).toHaveLength(1);

        field.abrirModal();
        field._adicionarFotoAFila(makeBase64(100));
        const ok = field.salvarEvidencias();

        expect(ok).toBe(false);
        expect(field.getValue()).toHaveLength(1);
    });

    it('validate() bloqueia envio com 0 fotos quando required', () => {
        const field = makeField({ required: true });
        const valid = field.validate();
        expect(valid).toBe(false);
        expect(field.errors.length).toBeGreaterThan(0);
    });

    it('validate() não bloqueia foto sem inconformidade marcada', () => {
        const field = makeField({ required: true });
        field._adicionarFotoAFila(makeBase64(100));
        field.salvarEvidencias();

        const valid = field.validate();
        expect(valid).toBe(true);
    });

    it('carregarInconformidades filtra itens com ativo === false', async () => {
        window.smartCache = {
            loadDataSource: vi.fn().mockResolvedValue([
                { id: 'INC-001', label: 'Fiação exposta', ativo: true },
                { id: 'INC-002', label: 'Item desativado', ativo: false },
                { id: 'INC-003', label: 'Sem flag ativo' },
            ]),
        };
        const field = makeField();
        await field.carregarInconformidades();

        expect(field.inconformidadesOptions).toEqual([
            { id: 'INC-001', label: 'Fiação exposta' },
            { id: 'INC-003', label: 'Sem flag ativo' },
        ]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile && npx vitest run tests/gallery-inconformidade-field.test.js`
Expected: FAIL — `Cannot find module '../www/js/fields/types/GalleryInconformidadeField.js'` (file doesn't exist yet).

- [ ] **Step 3: Write the field class (logic — no render yet)**

Create `mobile/www/js/fields/types/GalleryInconformidadeField.js`:

```js
// js/fields/types/GalleryInconformidadeField.js
import BaseField from './BaseField.js';
import { uuidv7 } from '/js/ecoforms-core.js';

const CameraResultType = { DataUrl: 'dataUrl' };
const CameraSource = { Camera: 'CAMERA' };

function resolveCamera() {
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
    return window.Capacitor.Plugins.Camera;
  }
  return {
    getPhoto: async () => ({ dataUrl: '' }),
    pickImages: async () => ({ photos: [] }),
  };
}

function base64SizeInBytes(dataUrl) {
  const base64 = (dataUrl || '').split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * GalleryInconformidadeField - Coletor de evidências fotográficas com marcação
 * de inconformidades. Cada sessão de captura pode acumular várias fotos na
 * mesma fila (mesma marcação de inconformidades/observação), gerando uma
 * entrada por foto ao salvar.
 */
export default class GalleryInconformidadeField extends BaseField {
  constructor(config = {}) {
    super(config);

    this.maxFiles = Number(this.config.maxFiles) || 20;
    this.maxFileSizeKb = Number(this.config.maxFileSizeKb) || 5000;
    this.allowGalleryUpload = this.config.allowGalleryUpload === true;
    this.dataSourceKey = this.config.dataSource || null;

    if (!Array.isArray(this.value)) {
      this.value = [];
    }

    this.inconformidadesOptions = [];
    this.modalAberta = false;
    this.filaFotos = [];
    this.inconformidadesSelecionadas = [];
    this.observacaoAtual = '';

    if (!window.fieldInstances) window.fieldInstances = {};
    window.fieldInstances[this.config.id] = this;

    this.carregarInconformidades();
  }

  async carregarInconformidades() {
    if (!this.dataSourceKey) return;
    let data = null;
    try {
      if (typeof window !== 'undefined' && window.smartCache && typeof window.smartCache.loadDataSource === 'function') {
        data = await window.smartCache.loadDataSource(this.dataSourceKey);
      }
    } catch (e) {
      console.warn('GalleryInconformidadeField: falha ao carregar catálogo', e);
    }
    const arr = Array.isArray(data) ? data : [];
    this.inconformidadesOptions = arr
      .filter((item) => item && item.ativo !== false)
      .map((item) => ({ id: item.id, label: item.label || item.nome || item.id }));
    this.updateDOM();
  }

  // ============ Fila de captura ============

  abrirModal() {
    this.modalAberta = true;
    this.filaFotos = [];
    this.inconformidadesSelecionadas = [];
    this.observacaoAtual = '';
    this.updateDOM();
  }

  fecharModal() {
    this.modalAberta = false;
    this.filaFotos = [];
    this.inconformidadesSelecionadas = [];
    this.observacaoAtual = '';
    this.updateDOM();
  }

  async tirarFoto() {
    try {
      const Camera = resolveCamera();
      const foto = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });
      if (foto && foto.dataUrl) {
        this._adicionarFotoAFila(foto.dataUrl);
        this.updateDOM();
      }
    } catch (error) {
      console.warn('GalleryInconformidadeField: câmera cancelada ou falhou', error);
    }
  }

  async escolherDaGaleria() {
    if (!this.allowGalleryUpload) return;
    try {
      const Camera = resolveCamera();
      const result = await Camera.pickImages({ quality: 80, limit: this.maxFiles });
      const photos = result && result.photos ? result.photos : [];
      for (const photo of photos) {
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        this._adicionarFotoAFila(dataUrl);
      }
      this.updateDOM();
    } catch (error) {
      console.warn('GalleryInconformidadeField: seleção de galeria cancelada ou falhou', error);
    }
  }

  _adicionarFotoAFila(base64DataUrl) {
    const sizeBytes = base64SizeInBytes(base64DataUrl);
    if (sizeBytes / 1024 > this.maxFileSizeKb) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Foto excede o tamanho máximo permitido de ${this.maxFileSizeKb}KB.`);
      }
      return false;
    }
    this.filaFotos.push({ localId: uuidv7(), imagemBase64: base64DataUrl });
    return true;
  }

  removerDaFila(localId) {
    this.filaFotos = this.filaFotos.filter((f) => f.localId !== localId);
    this.updateDOM();
  }

  toggleInconformidade(id) {
    if (this.inconformidadesSelecionadas.includes(id)) {
      this.inconformidadesSelecionadas = this.inconformidadesSelecionadas.filter((i) => i !== id);
    } else {
      this.inconformidadesSelecionadas.push(id);
    }
    this.updateDOM();
  }

  setObservacao(texto) {
    this.observacaoAtual = texto;
  }

  podeAdicionarMais() {
    return this.value.length < this.maxFiles;
  }

  salvarEvidencias() {
    if (this.filaFotos.length === 0) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Adicione ao menos uma foto antes de salvar.');
      }
      return false;
    }
    if (this.value.length + this.filaFotos.length > this.maxFiles) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Limite de ${this.maxFiles} fotos atingido para este campo.`);
      }
      return false;
    }

    const criadoEm = new Date().toISOString();
    const inconformidades = [...this.inconformidadesSelecionadas];
    const observacao = this.observacaoAtual;

    this.filaFotos.forEach((foto) => {
      this.value.push({
        id_foto: uuidv7(),
        imagem: foto.imagemBase64,
        criado_em: criadoEm,
        inconformidades,
        observacao,
      });
    });

    this.isDirty = true;
    this.fecharModal();
    return true;
  }

  editarEvidencia(idFoto) {
    const index = this.value.findIndex((e) => e.id_foto === idFoto);
    if (index === -1) return;
    const entry = this.value[index];
    this.value.splice(index, 1);

    this.modalAberta = true;
    this.filaFotos = [{ localId: uuidv7(), imagemBase64: entry.imagem }];
    this.inconformidadesSelecionadas = [...(entry.inconformidades || [])];
    this.observacaoAtual = entry.observacao || '';
    this.isDirty = true;
    this.updateDOM();
  }

  removerEvidencia(idFoto) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm('Remover esta evidência fotográfica?')) {
      return;
    }
    this.value = this.value.filter((e) => e.id_foto !== idFoto);
    this.isDirty = true;
    this.updateDOM();
  }

  updateDOM() {
    if (typeof document === 'undefined' || typeof this.render !== 'function') return;
    const container = document.querySelector(`[data-field-id="${this.config.id}"]`);
    if (container) {
      container.outerHTML = this.render();
    }
  }
}
```

Note: `render()` is intentionally not implemented yet — Task 4 adds it. `updateDOM()` is guarded so it's a no-op until `render()` exists, which keeps this task's tests (which never call `updateDOM()` in a way that would invoke `render()`) safe. Actually, several methods above (`abrirModal`, `fecharModal`, etc.) call `this.updateDOM()`, and `updateDOM()` calls `this.render()` if a container is found — but in the jsdom/happy-dom test environment there is no element with `data-field-id`, so `document.querySelector` returns `null` and `render()` is never actually invoked. This lets Task 3 land without a `render()` method and still pass every test.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx vitest run tests/gallery-inconformidade-field.test.js`
Expected: PASS — 9 tests passed.

- [ ] **Step 5: Commit**

```bash
git add mobile/www/js/fields/types/GalleryInconformidadeField.js mobile/tests/gallery-inconformidade-field.test.js
git commit -m "feat: add GalleryInconformidadeField core logic (queue, catalog, validation)"
```

---

### Task 4: Mobile field — rendering, CSS, and wiring

**Files:**
- Modify: `mobile/www/js/fields/types/GalleryInconformidadeField.js` (add `render()` and friends)
- Create: `mobile/www/css/fields/GalleryInconformidadeField.css`
- Modify: `mobile/www/js/fields/FieldFactory.js`
- Modify: `mobile/www/index.html`

**Interfaces:**
- Consumes: everything from Task 3.
- Produces: a fully working, selectable `composite_gallery_collector` field type in the mobile form engine — consumed by Task 7's manual verification.

- [ ] **Step 1: Add rendering methods to the field class**

In `mobile/www/js/fields/types/GalleryInconformidadeField.js`, replace the `updateDOM()` method (keep it) and add the following methods right before it (after `removerEvidencia`):

```js
  // ============ Render ============

  render() {
    const { id } = this.config;
    return `
      <div class="space-y-3 w-full" data-field-id="${id}" data-field-type="composite_gallery_collector">
        ${this.renderHeader()}
        ${this.renderErrors()}
        ${this.renderGaleria()}
        ${this.renderBotaoAdicionar()}
        ${this.modalAberta ? this.renderModal() : ''}
      </div>
    `;
  }

  renderHeader() {
    const { label, description, required } = this.config;
    return `
      <div class="mb-2">
        <label class="block text-lg font-semibold text-gray-900 mb-1">${this.escapeHtml(label)}${required ? ' *' : ''}</label>
        ${description ? `<p class="text-sm text-gray-500">${this.escapeHtml(description)}</p>` : ''}
      </div>
    `;
  }

  renderErrors() {
    if (!this.errors || this.errors.length === 0) return '';
    return `
      <div class="bg-orange-50 border border-orange-200 rounded-md p-3 mb-2">
        ${this.errors.map((e) => `<div class="text-xs text-orange-700">• ${this.escapeHtml(e)}</div>`).join('')}
      </div>
    `;
  }

  renderGaleria() {
    if (!this.value.length) {
      return `<div class="p-4 text-center text-gray-500 bg-gray-50 rounded border border-gray-100">Nenhuma evidência registrada ainda.</div>`;
    }
    return `
      <div class="grid grid-cols-2 gap-3">
        ${this.value.map((entry) => this.renderCard(entry)).join('')}
      </div>
    `;
  }

  renderCard(entry) {
    const qtd = entry.inconformidades ? entry.inconformidades.length : 0;
    const badgeText = qtd > 0 ? `⚠️ ${qtd} inconformidade(s)` : '✅ Sem apontamento';
    const badgeClass = qtd > 0 ? 'text-red-600' : 'text-green-600';
    return `
      <div class="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm" data-foto-id="${entry.id_foto}">
        <img src="${entry.imagem}" alt="Evidência fotográfica" class="w-full h-24 object-cover" />
        <div class="p-2">
          <div class="text-xs font-semibold ${badgeClass}">${badgeText}</div>
          ${entry.observacao ? `<div class="text-xs text-gray-500 line-clamp-2 mt-1">${this.escapeHtml(entry.observacao)}</div>` : ''}
        </div>
        <div class="absolute top-2 right-2 flex gap-1">
          <button type="button" class="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-xs" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'editarEvidencia', '${entry.id_foto}')" aria-label="Editar evidência">✏️</button>
          <button type="button" class="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-xs" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'removerEvidencia', '${entry.id_foto}')" aria-label="Remover evidência">🗑️</button>
        </div>
      </div>
    `;
  }

  renderBotaoAdicionar() {
    const disabled = !this.podeAdicionarMais();
    return `
      <button
        type="button"
        class="w-full h-10 rounded border-2 border-dashed border-gray-300 text-sm font-medium ${disabled ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-gray-700 hover:bg-gray-50'}"
        ${disabled ? 'disabled' : ''}
        onclick="${disabled ? '' : `window.galleryInconformidadeHandler('${this.config.id}', 'abrirModal')`}"
      >
        + Adicionar Registro Fotográfico (${this.value.length}/${this.maxFiles})
      </button>
    `;
  }

  renderModal() {
    return `
      <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onclick="if(event.target===this) window.galleryInconformidadeHandler('${this.config.id}', 'fecharModal')">
        <div class="bg-white rounded-xl w-full max-w-md mx-auto my-8 max-h-[85vh] overflow-y-auto p-6 space-y-3" onclick="event.stopPropagation()">
          <h3 class="text-base font-semibold text-gray-900">Nova Evidência Fotográfica</h3>

          ${this.renderFilaThumbnails()}

          <div class="flex gap-2">
            <button type="button" class="flex-1 h-10 rounded bg-white border border-gray-300 text-sm font-medium" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'tirarFoto')">📷 Tirar Foto</button>
            ${this.allowGalleryUpload ? `<button type="button" class="flex-1 h-10 rounded bg-white border border-gray-300 text-sm font-medium" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'escolherDaGaleria')">🖼️ Da Galeria</button>` : ''}
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Inconformidades Detectadas</label>
            ${this.renderInconformidadesCheckboxes()}
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Observação (opcional)</label>
            <textarea
              class="w-full min-h-[80px] p-3 text-sm border border-gray-300 rounded-md outline-none resize-y"
              placeholder="Detalhes adicionais..."
              onchange="window.galleryInconformidadeHandler('${this.config.id}', 'setObservacao', this.value)"
            >${this.escapeHtml(this.observacaoAtual || '')}</textarea>
          </div>

          <div class="flex justify-between gap-2 pt-2">
            <button type="button" class="flex-1 h-10 rounded bg-gray-100 text-gray-700 text-sm font-medium" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'fecharModal')">Cancelar</button>
            <button type="button" class="flex-1 h-10 rounded bg-green-600 text-white text-sm font-medium" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'salvarEvidencias')">Salvar (${this.filaFotos.length})</button>
          </div>
        </div>
      </div>
    `;
  }

  renderFilaThumbnails() {
    if (!this.filaFotos.length) {
      return `<div class="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">Nenhuma foto na fila. Toque em "Tirar Foto".</div>`;
    }
    return `
      <div class="flex flex-wrap gap-2">
        ${this.filaFotos.map((foto) => `
          <div class="relative w-20 h-20">
            <img src="${foto.imagemBase64}" alt="Foto pendente" class="w-full h-full object-cover rounded-lg border border-gray-200" />
            <button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'removerDaFila', '${foto.localId}')" aria-label="Remover foto da fila">✕</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderInconformidadesCheckboxes() {
    if (!this.inconformidadesOptions.length) {
      return `<div class="text-xs text-gray-400 italic">Nenhuma inconformidade cadastrada no catálogo.</div>`;
    }
    return `
      <div class="space-y-1 max-h-[150px] overflow-y-auto border border-gray-100 rounded p-2">
        ${this.inconformidadesOptions.map((opt) => `
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              ${this.inconformidadesSelecionadas.includes(opt.id) ? 'checked' : ''}
              onchange="window.galleryInconformidadeHandler('${this.config.id}', 'toggleInconformidade', '${opt.id}')"
            />
            ${this.escapeHtml(opt.label)}
          </label>
        `).join('')}
      </div>
    `;
  }
```

Then, at the very end of the file (after the class's closing `}`), add the global dispatcher:

```js

// ============================================
// HANDLER GLOBAL
// ============================================

window.galleryInconformidadeHandler = function (fieldId, action, ...args) {
  const field = window.fieldInstances ? window.fieldInstances[fieldId] : null;
  if (!field) {
    console.error(`GalleryInconformidadeField não encontrado: ${fieldId}`);
    return;
  }

  switch (action) {
    case 'abrirModal': field.abrirModal(); break;
    case 'fecharModal': field.fecharModal(); break;
    case 'tirarFoto': field.tirarFoto(); break;
    case 'escolherDaGaleria': field.escolherDaGaleria(); break;
    case 'removerDaFila': field.removerDaFila(args[0]); break;
    case 'toggleInconformidade': field.toggleInconformidade(args[0]); break;
    case 'setObservacao': field.setObservacao(args[0]); break;
    case 'salvarEvidencias': field.salvarEvidencias(); break;
    case 'editarEvidencia': field.editarEvidencia(args[0]); break;
    case 'removerEvidencia': field.removerEvidencia(args[0]); break;
    default: console.warn(`GalleryInconformidadeField: ação desconhecida ${action}`);
  }
};
```

- [ ] **Step 2: Run the Task 3 tests again to confirm no regression**

Run: `cd mobile && npx vitest run tests/gallery-inconformidade-field.test.js`
Expected: PASS — same 9 tests still passing (adding `render()` doesn't change any tested behavior, since no test triggers a real DOM container).

- [ ] **Step 3: Create the CSS shim**

Create `mobile/www/css/fields/GalleryInconformidadeField.css`:

```css
/*
 * GalleryInconformidadeField.css - Tailwind Shim
 *
 * Utility classes usadas por GalleryInconformidadeField que não estão
 * cobertas pelo tailwind.css purgado nem pelos shims já carregados
 * (VistoriaChecklistField.css, ChecklistField.css, OccupationField.css).
 */

.fixed {
    position: fixed;
}

.inset-0 {
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
}

.z-50 {
    z-index: 50;
}

.bg-black\/60 {
    background-color: rgba(0, 0, 0, 0.6);
}

.max-w-md {
    max-width: 28rem;
}

.max-h-\[85vh\] {
    max-height: 85vh;
}

.max-h-\[150px\] {
    max-height: 150px;
}

.overflow-y-auto {
    overflow-y: auto;
}

.mx-auto {
    margin-left: auto;
    margin-right: auto;
}

.my-8 {
    margin-top: 2rem;
    margin-bottom: 2rem;
}

.p-6 {
    padding: 1.5rem;
}

.mb-2 {
    margin-bottom: 0.5rem;
}

.pt-2 {
    padding-top: 0.5rem;
}

.gap-1 {
    gap: 0.25rem;
}

.opacity-50 {
    opacity: 0.5;
}

.cursor-not-allowed {
    cursor: not-allowed;
}

.bg-gray-50 {
    background-color: #f9fafb;
}

.bg-gray-100 {
    background-color: #f3f4f6;
}

.rounded-xl {
    border-radius: 0.75rem;
}

.top-2 {
    top: 0.5rem;
}

.right-2 {
    right: 0.5rem;
}

.w-6 {
    width: 1.5rem;
}

.h-6 {
    height: 1.5rem;
}

.h-24 {
    height: 6rem;
}

.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
```

- [ ] **Step 4: Register the field type in FieldFactory**

In `mobile/www/js/fields/FieldFactory.js`, add the import near the other field type imports (after `import HiddenField from './types/HiddenField.js';`, before `import CheckboxField ...`):

```js
import GalleryInconformidadeField from './types/GalleryInconformidadeField.js';
```

Then add to `FIELD_TYPE_MAP`, right after the `vistoria_checklist`/`vistoria-checklist` entries:

```js
  'vistoria_checklist': VistoriaChecklistField,
  'vistoria-checklist': VistoriaChecklistField,
  'unified_checklist': ChecklistField,
  'unified-checklist': ChecklistField,

  composite_gallery_collector: GalleryInconformidadeField,
  galeria_inconformidades: GalleryInconformidadeField, // alias
```

- [ ] **Step 5: Link the CSS in index.html**

In `mobile/www/index.html`, add the new stylesheet link right after the `VistoriaChecklistField.css` line (line 22):

```html
  <link href="css/fields/VistoriaChecklistField.css" rel="stylesheet">
  <link href="css/fields/GalleryInconformidadeField.css" rel="stylesheet">
  <link href="css/fields/ChecklistField.css" rel="stylesheet">
```

- [ ] **Step 6: Verify FieldFactory resolves the new type**

Run: `cd mobile && npx vitest run tests/gallery-inconformidade-field.test.js` (re-run to confirm nothing broke from the FieldFactory import graph)
Expected: PASS — 9 tests passed. (`FieldFactory.js` isn't imported by the test file, so this step is a smoke check that the overall test suite is still green, not a direct test of the factory registration — direct verification of factory dispatch happens in Task 7's manual browser check.)

- [ ] **Step 7: Commit**

```bash
git add mobile/www/js/fields/types/GalleryInconformidadeField.js mobile/www/css/fields/GalleryInconformidadeField.css mobile/www/js/fields/FieldFactory.js mobile/www/index.html
git commit -m "feat: render GalleryInconformidadeField and wire it into the mobile field factory"
```

---

### Task 5: Desktop renderer (TDD helper + component + wiring)

**Files:**
- Create: `desktop/src/lib/gallery-inconformidade.ts`
- Test: `desktop/src/lib/__tests__/gallery-inconformidade.test.ts` (new)
- Create: `desktop/components/runtime/fields/GalleryInconformidadeRenderer.tsx`
- Modify: `desktop/components/runtime/FormFieldRenderer.tsx`
- Modify: `desktop/components/runtime/FormRenderer.tsx`

**Interfaces:**
- Consumes: `getRegistrySource`/`normalizeSelectionOptions` from `./option-utils`; `useDataRegistryAggregated` from `@/src/interface/hooks/catalog/data-registry`; shadcn `Dialog`/`Badge`/`Button`/`Textarea`/`Label`.
- Produces: `GalleryInconformidadeEntry` type and `buildEntriesFromQueue()` (consumed by the renderer component and its test); `GalleryInconformidadeRenderer` React component (consumed by `FormFieldRenderer.tsx`'s dispatch).

**Important:** `desktop/vitest.config.ts` only includes `src/**/*.test.{ts,tsx}` — a test under `desktop/components/` would never run. That's why the testable pure logic lives in `desktop/src/lib/`, not next to the component.

- [ ] **Step 1: Write the failing test for the pure helper**

Create `desktop/src/lib/__tests__/gallery-inconformidade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildEntriesFromQueue } from '../gallery-inconformidade';

describe('buildEntriesFromQueue', () => {
    it('cria uma entrada por foto na fila, todas com as mesmas inconformidades e observação', () => {
        const queue = [
            { localId: 'a', imagemBase64: 'data:image/jpeg;base64,AAA' },
            { localId: 'b', imagemBase64: 'data:image/jpeg;base64,BBB' },
        ];
        const entries = buildEntriesFromQueue(queue, ['INC-001', 'INC-004'], 'Duas evidências');

        expect(entries).toHaveLength(2);
        entries.forEach((entry, i) => {
            expect(entry.imagem).toBe(queue[i].imagemBase64);
            expect(entry.inconformidades).toEqual(['INC-001', 'INC-004']);
            expect(entry.observacao).toBe('Duas evidências');
            expect(entry.id_foto).toBeTruthy();
            expect(entry.criado_em).toBeTruthy();
        });
        const ids = entries.map((e) => e.id_foto);
        expect(new Set(ids).size).toBe(2);
    });

    it('retorna array vazio quando a fila está vazia', () => {
        expect(buildEntriesFromQueue([], [], '')).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop && npx vitest run src/lib/__tests__/gallery-inconformidade.test.ts`
Expected: FAIL — `Cannot find module '../gallery-inconformidade'`.

- [ ] **Step 3: Write the pure helper**

Create `desktop/src/lib/gallery-inconformidade.ts`:

```ts
import { uuidv7 } from 'ecoforms-core';

export interface GalleryInconformidadeEntry {
    id_foto: string;
    imagem: string;
    criado_em: string;
    inconformidades: string[];
    observacao: string;
}

export interface QueuedPhoto {
    localId: string;
    imagemBase64: string;
}

/** Ephemeral id for an in-progress queue item — never persisted. Not a UUID v7: the Global Constraint requiring UUID v7 applies to persisted ids like id_foto, generated below via uuidv7(). */
export function makeLocalId(): string {
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildEntriesFromQueue(
    queue: QueuedPhoto[],
    inconformidades: string[],
    observacao: string,
): GalleryInconformidadeEntry[] {
    const criadoEm = new Date().toISOString();
    return queue.map((foto) => ({
        id_foto: uuidv7(),
        imagem: foto.imagemBase64,
        criado_em: criadoEm,
        inconformidades: [...inconformidades],
        observacao,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop && npx vitest run src/lib/__tests__/gallery-inconformidade.test.ts`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit the helper**

```bash
git add desktop/src/lib/gallery-inconformidade.ts desktop/src/lib/__tests__/gallery-inconformidade.test.ts
git commit -m "feat: add buildEntriesFromQueue helper for desktop gallery-inconformidade field"
```

- [ ] **Step 6: Write the renderer component**

Create `desktop/components/runtime/fields/GalleryInconformidadeRenderer.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { FormField } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, Pencil, X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { useDataRegistryAggregated } from "@/src/interface/hooks/catalog/data-registry";
import { getRegistrySource, normalizeSelectionOptions } from "./option-utils";
import {
    type GalleryInconformidadeEntry,
    type QueuedPhoto,
    makeLocalId,
    buildEntriesFromQueue,
} from "@/src/lib/gallery-inconformidade";

interface GalleryInconformidadeRendererProps {
    field: FormField;
    value: GalleryInconformidadeEntry[];
    onChange: (value: GalleryInconformidadeEntry[]) => void;
    readOnly?: boolean;
}

function getConfigNumber(field: FormField, key: string, fallback: number): number {
    const cfg = field.config;
    if (cfg && typeof cfg === "object" && typeof (cfg as Record<string, unknown>)[key] === "number") {
        return (cfg as Record<string, unknown>)[key] as number;
    }
    return fallback;
}

export function GalleryInconformidadeRenderer({ field, value = [], onChange, readOnly = false }: GalleryInconformidadeRendererProps) {
    const maxFiles = getConfigNumber(field, "maxFiles", 20);
    const maxFileSizeKb = getConfigNumber(field, "maxFileSizeKb", 5000);

    const [modalOpen, setModalOpen] = useState(false);
    const [queue, setQueue] = useState<QueuedPhoto[]>([]);
    const [selectedInconformidades, setSelectedInconformidades] = useState<string[]>([]);
    const [observacao, setObservacao] = useState("");

    const { data: fetchedData } = useDataRegistryAggregated(getRegistrySource(field));

    const options = useMemo(() => {
        const normalized = normalizeSelectionOptions(fetchedData);
        return normalized.filter((opt) => (opt as Record<string, unknown>).ativo !== false);
    }, [fetchedData]);

    const openModal = () => {
        setQueue([]);
        setSelectedInconformidades([]);
        setObservacao("");
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setQueue([]);
        setSelectedInconformidades([]);
        setObservacao("");
    };

    const addFileToQueue = (file: File) => {
        if (file.size / 1024 > maxFileSizeKb) {
            alert(`Foto excede o tamanho máximo permitido de ${maxFileSizeKb}KB.`);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setQueue((prev) => [...prev, { localId: makeLocalId(), imagemBase64: reader.result as string }]);
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach(addFileToQueue);
        e.target.value = "";
    };

    const removeFromQueue = (id: string) => {
        setQueue((prev) => prev.filter((f) => f.localId !== id));
    };

    const toggleInconformidade = (id: string) => {
        setSelectedInconformidades((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const handleSave = () => {
        if (queue.length === 0) {
            alert("Adicione ao menos uma foto antes de salvar.");
            return;
        }
        if (value.length + queue.length > maxFiles) {
            alert(`Limite de ${maxFiles} fotos atingido para este campo.`);
            return;
        }
        const entries = buildEntriesFromQueue(queue, selectedInconformidades, observacao);
        onChange([...value, ...entries]);
        closeModal();
    };

    const editEntry = (idFoto: string) => {
        const entry = value.find((e) => e.id_foto === idFoto);
        if (!entry) return;
        onChange(value.filter((e) => e.id_foto !== idFoto));
        setQueue([{ localId: makeLocalId(), imagemBase64: entry.imagem }]);
        setSelectedInconformidades([...entry.inconformidades]);
        setObservacao(entry.observacao || "");
        setModalOpen(true);
    };

    const removeEntry = (idFoto: string) => {
        if (!confirm("Remover esta evidência fotográfica?")) return;
        onChange(value.filter((e) => e.id_foto !== idFoto));
    };

    const canAddMore = value.length < maxFiles;

    return (
        <div className="space-y-3">
            <Label>
                {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>

            {value.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground bg-muted/20 rounded border border-dashed">
                    Nenhuma evidência registrada ainda.
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {value.map((entry) => (
                        <div key={entry.id_foto} className="relative group border rounded-md overflow-hidden bg-slate-50">
                            <img src={entry.imagem} alt="Evidência" className="w-full h-24 object-cover" />
                            <div className="p-2 space-y-1">
                                <div className={cn("text-xs font-semibold", entry.inconformidades.length > 0 ? "text-red-600" : "text-green-600")}>
                                    {entry.inconformidades.length > 0
                                        ? `⚠️ ${entry.inconformidades.length} inconformidade(s)`
                                        : "✅ Sem apontamento"}
                                </div>
                            </div>
                            {!readOnly && (
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <Button type="button" variant="secondary" size="icon" className="h-6 w-6" onClick={() => editEntry(entry.id_foto)}>
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button type="button" variant="destructive" size="icon" className="h-6 w-6" onClick={() => removeEntry(entry.id_foto)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!readOnly && (
                <Button type="button" variant="secondary" disabled={!canAddMore} onClick={openModal}>
                    <Camera className="mr-2 h-4 w-4" />
                    Adicionar Registro Fotográfico ({value.length}/{maxFiles})
                </Button>
            )}

            <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Evidência Fotográfica</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {queue.length === 0 ? (
                            <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20 rounded border border-dashed">
                                Nenhuma foto na fila. Selecione um ou mais arquivos.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {queue.map((foto) => (
                                    <div key={foto.localId} className="relative w-20 h-20">
                                        <img src={foto.imagemBase64} alt="Foto pendente" className="w-full h-full object-cover rounded-lg border" />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                            onClick={() => removeFromQueue(foto.localId)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <Button variant="secondary" className="relative cursor-pointer" type="button">
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                            <Camera className="mr-2 h-4 w-4" />
                            Selecionar Foto(s)
                        </Button>

                        <div className="space-y-2">
                            <Label className="text-xs">Inconformidades Detectadas</Label>
                            <div className="flex flex-wrap gap-2">
                                {options.map((option) => {
                                    const isSelected = selectedInconformidades.includes(option.value);
                                    return (
                                        <Badge
                                            key={option.value}
                                            variant={isSelected ? "default" : "outline"}
                                            className="cursor-pointer select-none"
                                            onClick={() => toggleInconformidade(option.value)}
                                        >
                                            {option.label}
                                        </Badge>
                                    );
                                })}
                                {options.length === 0 && (
                                    <span className="text-xs text-muted-foreground italic">Nenhuma inconformidade cadastrada no catálogo.</span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Observação (opcional)</Label>
                            <Textarea
                                value={observacao}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObservacao(e.target.value)}
                                placeholder="Detalhes adicionais..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                        <Button type="button" onClick={handleSave}>Salvar ({queue.length})</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
```

- [ ] **Step 7: Wire the dispatch case into FormFieldRenderer.tsx**

In `desktop/components/runtime/FormFieldRenderer.tsx`, add the import near the other field renderer imports (after `import { RepeatableGroupRenderer } from "./fields/RepeatableGroupRenderer";`):

```tsx
import { GalleryInconformidadeRenderer } from "./fields/GalleryInconformidadeRenderer";
import type { GalleryInconformidadeEntry } from "@/src/lib/gallery-inconformidade";
```

Add a value-coercion helper pair near `toRepeatableItems`/`fromRepeatableItems` (after their definitions, around line 210-212):

```tsx
function toGalleryInconformidadeEntries(value: FormFieldValue): GalleryInconformidadeEntry[] {
    return toArrayValue(value).filter((item): item is GalleryInconformidadeEntry => {
        return !!item && typeof item === "object" && !Array.isArray(item)
            && "id_foto" in item && typeof (item as Record<string, unknown>).id_foto === "string";
    }) as GalleryInconformidadeEntry[];
}

function fromGalleryInconformidadeEntries(entries: GalleryInconformidadeEntry[]): FormFieldObjectValue[] {
    return entries.map((entry) => ({ ...entry })) as unknown as FormFieldObjectValue[];
}
```

Add the dispatch case in the `switch (normalizedType)` block, right after the `case "gallery":` block (after its closing `);` around line 552):

```tsx
        case "composite_gallery_collector":
            return (
                <GalleryInconformidadeRenderer
                    field={resolvedField}
                    value={toGalleryInconformidadeEntries(value)}
                    onChange={(nextValue) => onChange(fromGalleryInconformidadeEntries(nextValue))}
                    readOnly={readOnly}
                />
            );
```

(No wrapping `<Label>` div — `GalleryInconformidadeRenderer` renders `field.label` itself, matching how the `vistoria_checklist` case also omits it.)

- [ ] **Step 8: Add the type to fullWidthTypes in FormRenderer.tsx**

In `desktop/components/runtime/FormRenderer.tsx`, in the `fullWidthTypes` array (around line 41-60), add the new type in the "Captura de mídia" group:

```tsx
        // Captura de mídia
        'signature',
        'photo',
        'gallery',
        'file',
        'files',
        'composite_gallery_collector',
```

- [ ] **Step 9: Verify field-type-map.ts needs no change**

Run: `grep -n "composite_gallery_collector\|default:" desktop/lib/form/field-type-map.ts desktop/src/lib/field-type-map.ts`
Expected: both files show only the existing `default: return type;` line — confirming `composite_gallery_collector` already passes through `normalizeFieldType` unchanged, since it isn't one of the four remapped cases (`checklist`, `geolocation`, `camera`, `select_field`). No edit needed to either file.

- [ ] **Step 10: Typecheck the desktop app**

Run: `cd desktop && npx tsc --noEmit`
Expected: no new type errors introduced by this task's changes. (Pre-existing unrelated errors, if any, are not this task's concern — only confirm no *new* ones appear in the files touched by this task.)

- [ ] **Step 11: Re-run the helper test to confirm nothing broke**

Run: `cd desktop && npx vitest run src/lib/__tests__/gallery-inconformidade.test.ts`
Expected: PASS — 2 tests passed.

- [ ] **Step 12: Commit**

```bash
git add desktop/components/runtime/fields/GalleryInconformidadeRenderer.tsx desktop/components/runtime/FormFieldRenderer.tsx desktop/components/runtime/FormRenderer.tsx
git commit -m "feat: add GalleryInconformidadeRenderer and wire it into the desktop form engine"
```

---

### Task 6: Desktop builder UI (FieldPropertiesPanel)

**Files:**
- Modify: `desktop/components/forms/FieldPropertiesPanel.tsx`

**Interfaces:**
- Consumes: `getConfigBool`/`getConfigNumber`/`updateConfig` helpers already defined at the top of the file (lines 38-63); `Switch`/`Input`/`Label` from `@/components/ui/*`.
- Produces: builder UI that lets a form author pick `composite_gallery_collector` as a field type and configure `maxFiles`/`maxFileSizeKb`/`allowGalleryUpload` — the `dataSource` picker is already generic (`SourceCodeSelector`, unconditional for every field type) and needs no change.

- [ ] **Step 1: Add the type option to the dropdown**

In `desktop/components/forms/FieldPropertiesPanel.tsx`, in the type `<Select>` (around line 236-238), add the new option right after the vistoria checklist entries:

```tsx
                            <SelectItem value="vistoria_checklist">Vistoria Checklist</SelectItem>
                            <SelectItem value="vistoria-checklist">Vistoria Checklist (Alias)</SelectItem>
                            <SelectItem value="checklist">Checklist (Alias)</SelectItem>
                            <SelectItem value="composite_gallery_collector">Galeria de Inconformidades</SelectItem>
```

- [ ] **Step 2: Add the config block**

Right after the existing `vistoria_checklist` config block closes (after line 408, `)}`, and before the `['select', 'select-field', 'radio', 'chips', 'chips_multiple'].includes(field.type)` block), add:

```tsx
            {field.type === 'composite_gallery_collector' && (
                <div className="space-y-3 border-t pt-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Configurações da Galeria de Inconformidades
                    </Label>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Máximo de fotos</Label>
                        <Input
                            type="number"
                            min={1}
                            max={100}
                            value={getConfigNumber(field, 'maxFiles', 20)}
                            onChange={(e) => updateConfig(field, update, 'maxFiles', Math.max(1, Number(e.target.value) || 20))}
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Tamanho máximo por foto (KB)</Label>
                        <Input
                            type="number"
                            min={100}
                            max={20000}
                            value={getConfigNumber(field, 'maxFileSizeKb', 5000)}
                            onChange={(e) => updateConfig(field, update, 'maxFileSizeKb', Math.max(100, Number(e.target.value) || 5000))}
                            className="h-9"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor={`gic-gallery-${field.id}`} className="text-sm">Permitir escolher da galeria (mobile)</Label>
                        <Switch
                            id={`gic-gallery-${field.id}`}
                            checked={getConfigBool(field, 'allowGalleryUpload', false)}
                            onCheckedChange={(checked) => updateConfig(field, update, 'allowGalleryUpload', checked)}
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        A lista de inconformidades vem do Código Fonte (Data Registry) selecionado acima, tipo &quot;inconformidades_padrao&quot;.
                    </p>
                </div>
            )}
```

- [ ] **Step 3: Typecheck**

Run: `cd desktop && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add desktop/components/forms/FieldPropertiesPanel.tsx
git commit -m "feat: add composite_gallery_collector to the desktop form builder UI"
```

---

### Task 7: Manual end-to-end verification

**Files:** none (verification only — no automated test infrastructure exists for full-form rendering on either platform, consistent with zero prior coverage for any other field type's end-to-end flow).

- [ ] **Step 1: Verify the catalog seed via the existing admin UI**

Run: `cd desktop && npm run dev`, open `http://localhost:3000/data-registry` (or the port your dev server prints), and confirm 5 entries under `tipo=inconformidades_padrao` are visible and editable.

- [ ] **Step 2: Verify the desktop builder**

In the desktop app's form builder, add a new field, set its type to "Galeria de Inconformidades", set `dataSource` (Código Fonte) to `inconformidades_padrao`, and set `maxFiles`/`maxFileSizeKb`/`allowGalleryUpload`. Confirm the generated field JSON (JSON tab of the builder, if present) shows `dataSource` at the root and `maxFiles`/`maxFileSizeKb`/`allowGalleryUpload` under `config`.

- [ ] **Step 3: Verify the desktop runtime**

Render that field in a test form (any existing form page that can preview a single field, or a throwaway form created for this check). Confirm:
- The field renders full-width.
- "Adicionar Registro Fotográfico" opens the dialog.
- Selecting 2 image files at once queues both with thumbnails.
- Checking 2 inconformidade badges highlights them.
- Typing an observação and clicking "Salvar" adds 2 cards to the grid, each showing the same inconformidade count.
- Clicking the trash icon removes a card (with a confirm prompt).
- Clicking the pencil icon reopens the dialog pre-filled with that photo and its tags.
- Selecting a file larger than the configured `maxFileSizeKb` triggers the size-limit alert and is not added to the queue.
- Adding photos until `maxFiles` is reached disables the "Adicionar" button.
- Inspect the submitted payload (browser devtools → Network/console, or a temporary `console.log(dadosOrganizados)` in `FormRenderer.tsx`'s submit handler) and confirm each array entry matches `{id_foto, imagem, criado_em, inconformidades, observacao}` with `imagem` as a `data:image/...;base64,...` string.

- [ ] **Step 4: Verify the mobile runtime**

Run: `cd mobile && npm run serve`, open the dev server in a browser (camera capture will fall back to the built-in mock since no real Capacitor Camera plugin is available outside a device/emulator — note this limitation and, if a physical Android device or emulator is available via `npm run debug-mobile`, prefer that for a real camera check).

Confirm in a test form containing this field:
- The gallery grid and "Adicionar Registro Fotográfico" button render.
- Opening the modal, tapping "Tirar Foto" (or using the mock fallback) adds a queued photo.
- Checking inconformidade checkboxes and typing an observação, then "Salvar", adds a card with the correct badge count.
- Editing and removing a card work as expected.
- The catalog checkboxes only show entries where `ativo !== false` (temporarily flip one seeded row's `ativo` to `false` via `/data-registry` on desktop, resync/reload on mobile, and confirm it disappears from the checkbox list).

- [ ] **Step 5: Run the full mobile and desktop test suites once more**

Run: `cd mobile && npx vitest run` and `cd desktop && npx vitest run`
Expected: all pre-existing tests still pass, plus the new ones from Tasks 1, 3, and 5.

- [ ] **Step 6: Update the spec's status**

In `docs/superpowers/specs/2026-07-09-galeria-inconformidades-design.md`, change the `Status:` line from `Aprovado (design) — pendente plano de implementação` to `Implementado — ver docs/superpowers/plans/2026-07-09-galeria-inconformidades.md`.

```bash
git add docs/superpowers/specs/2026-07-09-galeria-inconformidades-design.md
git commit -m "docs: mark composite_gallery_collector spec as implemented"
```
