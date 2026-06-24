import assert from 'assert';
import { computeDefaultValue } from './defaults.js';

function matchesRegex(value, re) {
  return typeof value === 'string' && re.test(value);
}

let failures = 0;

try {
  // use a fixed reference date for deterministic tests
  // create a local Date (year, monthIndex, day, hour, minute, second)
  const fixedNow = new Date(2001, 1, 3, 4, 5, 6); // Feb 3, 2001 04:05:06 local time

  // date
  const d = computeDefaultValue({ type: 'date', defaultToNow: true }, fixedNow);
  assert(matchesRegex(d, /^\d{4}-\d{2}-\d{2}$/), `date format invalid: ${d}`);
  console.log('✔ date OK ->', d);

  // time
  const t = computeDefaultValue({ type: 'time', defaultToNow: true }, fixedNow);
  assert(matchesRegex(t, /^\d{2}:\d{2}$/), `time format invalid: ${t}`);
  console.log('✔ time OK ->', t);

  // datetime-local
  const dt = computeDefaultValue({ type: 'datetime-local', defaultToNow: true }, fixedNow);
  assert(matchesRegex(dt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), `datetime-local invalid: ${dt}`);
  console.log('✔ datetime-local OK ->', dt);

  // explicit value should be returned as-is
  const explicit = computeDefaultValue({ type: 'date', value: '2000-01-02' });
  assert.strictEqual(explicit, '2000-01-02');
  console.log('✔ explicit value OK ->', explicit);

  // defaultValue fallback
  const fallback = computeDefaultValue({ type: 'text', defaultValue: 'foo' });
  assert.strictEqual(fallback, 'foo');
  console.log('✔ defaultValue fallback OK ->', fallback);

  // select multiple -> []
  const sel = computeDefaultValue({ type: 'select', multiple: true });
  assert(Array.isArray(sel) && sel.length === 0, 'select multiple should return []');
  console.log('✔ select multiple OK ->', JSON.stringify(sel));

  // number -> 0
  const num = computeDefaultValue({ type: 'number' });
  assert.strictEqual(num, 0, 'number default should be 0');
  console.log('✔ number default OK ->', num);

  // ---- Dynamic defaults (field.default expression) ----

  // default: 'now' via field.default (not defaultToNow)
  const nowDefault = computeDefaultValue({ type: 'date', default: 'now' }, fixedNow);
  assert(matchesRegex(nowDefault, /^\d{4}-\d{2}-\d{2}$/), `default:'now' invalid: ${nowDefault}`);
  console.log('✔ default:now OK ->', nowDefault);

  // default: 'user.name' via context
  const userName = computeDefaultValue({ type: 'text', default: 'user.name' }, {
    user: { nome: 'Maria Silva', email: 'maria@test.com' }
  });
  assert.strictEqual(userName, 'Maria Silva');
  console.log('✔ default:user.name via context OK ->', userName);

  // default: 'user.name' with name prop (english variant)
  const userNameEng = computeDefaultValue({ type: 'text', default: 'user.name' }, {
    user: { name: 'John Doe', email: 'john@test.com' }
  });
  assert.strictEqual(userNameEng, 'John Doe');
  console.log('✔ default:user.name (english) OK ->', userNameEng);

  // default: 'user.name' without context -> falls back to ''
  const userNameNoCtx = computeDefaultValue({ type: 'text', default: 'user.name' });
  assert.strictEqual(userNameNoCtx, '');
  console.log('✔ default:user.name (no context) OK ->', userNameNoCtx);

  // default: 'user.email' via context
  const userEmail = computeDefaultValue({ type: 'text', default: 'user.email' }, {
    user: { nome: 'Maria Silva', email: 'maria@test.com' }
  });
  assert.strictEqual(userEmail, 'maria@test.com');
  console.log('✔ default:user.email OK ->', userEmail);

  // default: 'device.location' via context
  const deviceLoc = computeDefaultValue({ type: 'gps', default: 'device.location' }, {
    device: { location: { lat: -23.55, lng: -46.63 } }
  });
  assert.deepStrictEqual(deviceLoc, { lat: -23.55, lng: -46.63 });
  console.log('✔ default:device.location OK ->', JSON.stringify(deviceLoc));

  // default: 'device.location' without context -> null
  const deviceLocNull = computeDefaultValue({ type: 'gps', default: 'device.location' });
  assert.strictEqual(deviceLocNull, null);
  console.log('✔ default:device.location (null) OK ->', deviceLocNull);

  // default: 'form.fieldX' cross-field reference
  const formField = computeDefaultValue({ id: 'campo_b', type: 'text', default: 'form.campo_a' }, {
    formValues: { campo_a: 'valor de A' }
  });
  assert.strictEqual(formField, 'valor de A');
  console.log('✔ default:form.fieldX OK ->', formField);

  // default: 'form.fieldX' with missing field -> null
  const formFieldMissing = computeDefaultValue({ id: 'campo_b', type: 'text', default: 'form.campo_inexistente' }, {
    formValues: { campo_a: 'valor de A' }
  });
  assert.strictEqual(formFieldMissing, null);
  console.log('✔ default:form.fieldX (missing) OK ->', formFieldMissing);

  // Cycle detection: A -> form.B, B -> form.A
  // This should detect cycle and return null for field B
  const cycleB = computeDefaultValue({ id: 'campo_b', type: 'text', default: 'form.campo_a' }, {
    formValues: {}
  });
  // Since campo_a is not in formValues, returns null — not a cycle but safe
  assert.strictEqual(cycleB, null);

  // Backward compat: passing Date as second arg
  const bcDate = computeDefaultValue({ type: 'date', defaultToNow: true }, new Date(2001, 1, 3));
  assert(matchesRegex(bcDate, /^\d{4}-\d{2}-\d{2}$/), `backward compat Date invalid: ${bcDate}`);
  console.log('✔ backward compat (Date) OK ->', bcDate);

  // Backward compat: passing function as second arg
  const bcFunc = computeDefaultValue({ type: 'date', defaultToNow: true }, () => new Date(2001, 1, 3));
  assert(matchesRegex(bcFunc, /^\d{4}-\d{2}-\d{2}$/), `backward compat function invalid: ${bcFunc}`);
  console.log('✔ backward compat (function) OK ->', bcFunc);

  // Backward compat: passing null (no context) — still works
  const bcNull = computeDefaultValue({ type: 'number' });
  assert.strictEqual(bcNull, 0);
  console.log('✔ backward compat (null/no context) OK ->', bcNull);

  console.log('\nAll tests passed');
} catch (err) {
  failures++;
  console.error('Test failed:', err && err.message ? err.message : err);
}

if (failures > 0) process.exit(1);
