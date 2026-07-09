// js/fields/FieldFactory.js
import BaseField from './types/BaseField.js';
import InputFieldBase from './types/InputFieldBase.js';
import ChipsField from './types/ChipsField.js';
import SelectField from './types/SelectField.js';
import DateTimeField from './types/DateTimeField.js';
import PasswordField from './types/PasswordField.js';
import TextField from './types/TextField.js';
import TextAreaField from './types/TextAreaField.js';
import NumberField from './types/NumberField.js';
import FileField from './types/FileField.js';
import CameraField from './types/CameraField.js';
import RadioField from './types/RadioField.js';
import CardsRadioField from './types/CardsRadioField.js';
import SelectorModalField from './types/SelectorModalField.js';
import PresenceField from './types/PresenceField.js';
import GalleryField from './types/GalleryField.js';
import GeolocationField from './types/GeolocationField.js';
import CaixasAvancadoField from './types/CaixasAvancadoField.js';
import FieldSkeleton from './types/FieldSkeleton.js';
// import DynamicToggleListField from './types/DynamicToggleListField.js'; // Loaded dynamically
import ChecklistField from './types/ChecklistField.js';
import GroupField from './types/GroupField.js';
import RepeatableGroupField from './types/RepeatableGroupField.js';
import OccupationField from './types/OccupationField.js';
import VistoriaChecklistField from './types/VistoriaChecklistField.js';
import HiddenField from './types/HiddenField.js';
import GalleryInconformidadeField from './types/GalleryInconformidadeField.js';
import CheckboxField from './types/CheckboxField.v2.js';

const FIELD_TYPE_MAP = {
  text: TextField,
  email: TextField,
  tel: TextField,
  url: TextField,
  number: NumberField,
  password: PasswordField,
  date: TextField,
  time: TextField,
  datetime: DateTimeField,
  'datetime-local': DateTimeField,
  textarea: TextAreaField,
  input: InputFieldBase,

  select: SelectField,
  'select-field': SelectField,
  'ecoponto_select': SelectField,
  checkbox: CheckboxField,
  radio: RadioField,

  hidden: HiddenField,


  file: FileField,
  camera: CameraField,
  photo: CameraField, // Alias for camera
  gallery: GalleryField,

  // Consolidated presence fields - all use PresenceField with auto-detection
  presence: PresenceField,
  'presence-list': PresenceField,
  'presence_list': PresenceField,
  'presence-lista': PresenceField,
  'presence_compact': PresenceField,
  'presence-compact': PresenceField,
  presencecompact: PresenceField,
  'presence-selector-compact': PresenceField,
  'presence_selector_compact': PresenceField,
  'presence-selector': PresenceField,

  chips: ChipsField,
  chipsmultiple: ChipsField,
  'chips-multiple': ChipsField,
  'chips_multiple': ChipsField,

  geolocation: GeolocationField,
  geolocalizacao: GeolocationField,
  gps: GeolocationField, // Alias for geolocation

  'caixas_avancado': CaixasAvancadoField,
  'caixas-avancado': CaixasAvancadoField,

  'cards-radio': CardsRadioField,
  cardsradio: CardsRadioField,
  'cards_radio': CardsRadioField,

  'selector-modal': SelectorModalField,
  selectormodal: SelectorModalField,
  'selector_modal': SelectorModalField,

  // Consolidated checklist fields - all use ChecklistField with auto-detection
  checklist: ChecklistField,
  'inspection_checklist': ChecklistField,
  'inspection-checklist': ChecklistField,
  'vistoria_checklist': VistoriaChecklistField,
  'vistoria-checklist': VistoriaChecklistField,
  'unified_checklist': ChecklistField,
  'unified-checklist': ChecklistField,

  composite_gallery_collector: GalleryInconformidadeField,
  galeria_inconformidades: GalleryInconformidadeField, // alias

  // 'occupation-selector-compact': OccupationSelectorCompactField, // REMOVED - Campo não funcional
  // 'occupation_selector_compact': OccupationSelectorCompactField, // REMOVED - Campo não funcional
  occupation: OccupationField,
  'occupation-selector': OccupationField,
  'occupation_selector': OccupationField,
  ocupacao: OccupationField,

  repeatable_group: RepeatableGroupField,
  repeatable: RepeatableGroupField,
  group: GroupField,
  skeleton: FieldSkeleton,
  user: TextField,

  default: BaseField
};

const DYNAMIC_TYPE_ALIASES = new Map([
  ['dynamic-toggle-list', 'dynamic-toggle-list'],
  ['dynamic_toggle_list', 'dynamic-toggle-list']
]);

function normalizeTypeKey(rawType = 'default') {
  const baseValue = rawType ?? 'default';
  const base = baseValue.toString().trim();
  const ordered = [];
  const seen = new Set();

  const push = (value) => {
    if (value === undefined || value === null) return;
    const trimmed = value.toString().trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    ordered.push(trimmed);
  };

  const camelSeparated = base.replace(/([a-z0-9])([A-Z])/g, '$1-$2');

  push(base || 'default');
  push(base.toLowerCase());
  push(camelSeparated);
  push(camelSeparated.toLowerCase());

  // Legacy "campo-" prefixed variants
  ordered.slice().forEach(candidate => {
    const withoutCampo = candidate.replace(/^campo[_-]?/i, '').replace(/^campo/i, '');
    push(withoutCampo);
  });

  // Hyphen/underscore normalization variants
  ordered.slice().forEach(candidate => {
    push(candidate.replace(/_/g, '-'));
    push(candidate.replace(/-/g, '_'));
  });

  // Additional targeted aliases
  if (seen.has('datetime')) push('datetime-local');
  if (seen.has('chipsmultiple')) {
    push('chips-multiple');
    push('chips_multiple');
  }

  push('default');

  return ordered;
}

export class FieldFactory {
  static create(config = {}, formData = {}, Alpine = undefined) {
    const fieldId = config.id || config.name;
    const alpineInstance = Alpine !== undefined ? Alpine : (typeof window !== 'undefined' ? window.Alpine : undefined);
    const typeCandidates = normalizeTypeKey(config.type || config.tipo || 'default');

    let lookup = null;
    let usedKey = null;
    let dynamicType = null;

    for (const key of typeCandidates) {
      const normalizedDynamic = DYNAMIC_TYPE_ALIASES.get(key);
      if (normalizedDynamic) {
        dynamicType = normalizedDynamic;
        usedKey = key;
        break;
      }

      if (FIELD_TYPE_MAP[key]) {
        lookup = FIELD_TYPE_MAP[key];
        usedKey = key;
        break;
      }
    }

    const originalType = (config.type || config.tipo || 'default').toString();

    if (dynamicType) {
      if (usedKey && usedKey !== originalType) {
        console.debug(`FieldFactory: tipo '${originalType}' resolvido para '${usedKey}' (dynamic)`);
      }
      return FieldFactory.createDynamicField(config, formData, alpineInstance, dynamicType);
    }

    if (!lookup) {
      lookup = FIELD_TYPE_MAP.default;
      console.warn(`FieldFactory: tipo de campo desconhecido '${originalType}', usando 'default'`);
    } else if (usedKey && usedKey !== originalType) {
      console.debug(`FieldFactory: tipo '${originalType}' resolvido para '${usedKey}'`);
    }

    return new lookup({
      ...config,
      value: formData && fieldId ? formData[fieldId] : config.value,
      formData,
      Alpine: alpineInstance
    });
  }

  static async createDynamicField(config = {}, formData = {}, Alpine = undefined, fieldType = '') {
    const fieldId = config.id || config.name;
    const alpineInstance = Alpine !== undefined ? Alpine : (typeof window !== 'undefined' ? window.Alpine : undefined);

    try {
      let FieldClass;

      // Dynamic import for fields that cause module conflicts
      if (fieldType === 'dynamic-toggle-list') {
        const module = await import('./types/DynamicToggleListField.js');
        FieldClass = module.default;
      }

      if (FieldClass) {
        return new FieldClass({
          ...config,
          value: formData && fieldId ? formData[fieldId] : config.value,
          formData,
          Alpine: alpineInstance
        });
      }
    } catch (error) {
      console.error(`FieldFactory: Erro ao carregar dinamicamente campo ${fieldType}:`, error);
    }

    // Fallback to default field
    return new FIELD_TYPE_MAP.default({
      ...config,
      value: formData && fieldId ? formData[fieldId] : config.value,
      formData,
      Alpine: alpineInstance
    });
  }

  static getSupportedTypes() {
    const types = new Set([
      ...Object.keys(FIELD_TYPE_MAP),
      ...DYNAMIC_TYPE_ALIASES.values()
    ]);
    return Array.from(types);
  }
}

export default FieldFactory;

if (typeof window !== 'undefined') {
  window.FieldFactory = FieldFactory;
}
