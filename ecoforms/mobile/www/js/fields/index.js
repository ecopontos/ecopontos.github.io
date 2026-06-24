// js/fields/index.js
// Ponto �nico de exporta��o para os campos din�micos.
// Use este arquivo para importar os principais s�mbolos do pacote de campos.

import BaseField from './types/BaseField.js';
import FieldFactory from './FieldFactory.js';

// Tipos de campos customizados principais
import ChipsField from './types/ChipsField.js';
import FileField from './types/FileField.js';
import TextAreaField from './types/TextAreaField.js';
import PresenceField from './types/PresenceField.js';
import SelectField from './types/SelectField.js';
import TextField from './types/TextField.js';
import NumberField from './types/NumberField.js';
import ChecklistField from './types/ChecklistField.js';
import OccupationField from './types/OccupationField.js';

// Utilidades consolidadas
import * as fieldUtils from './utils.js';
import * as presenceHelpers from './utils/presenceHelpers.js';
import DataValidator from './utils/dataValidator.js';

export {
  BaseField,
  FieldFactory,
  ChipsField,
  FileField,
  TextAreaField,
  PresenceField,
  SelectField,
  TextField,
  NumberField,
  ChecklistField,
  OccupationField,
  fieldUtils,
  presenceHelpers,
  DataValidator
};

export default {
  BaseField,
  FieldFactory,
  ChipsField,
  FileField,
  TextAreaField,
  PresenceField,
  SelectField,
  TextField,
  NumberField,
  ChecklistField,
  OccupationField,
  fieldUtils,
  presenceHelpers,
  DataValidator
};

// Tornar dispon�vel globalmente para compatibilidade com scripts n�o-modulares
if (typeof window !== 'undefined') {
  window.FieldFactory = FieldFactory;
  window.BaseField = BaseField;
  window.FieldUtils = fieldUtils;
  window.PresenceHelpers = presenceHelpers;
  window.DataValidator = DataValidator;
}
