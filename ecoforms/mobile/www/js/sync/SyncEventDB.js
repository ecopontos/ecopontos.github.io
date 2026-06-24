import { uuidv7 } from '../utils/uuid.js';
if (typeof globalThis.IDBKeyRange === 'undefined' && typeof window !== 'undefined') {
  window.IDBKeyRange = window.IDBKeyRange || {
    only(v) { return { lower: v, upper: v }; },
    bound(l, u) { return { lower: l, upper: u }; }
  };
}
if (typeof globalThis.IDBKeyRange === 'undefined') {
  globalThis.IDBKeyRange = {
    only(v) { return { lower: v, upper: v }; },
    bound(l, u) { return { lower: l, upper: u }; }
  };
}

let _db = null;
let _sql = null;
let _activeDb = null;
let _flushTimer = null;
let _indexedDB = null;

function _scheduleFlush() {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    if (_activeDb) _flushToIndexedDB(_activeDb);
    _flushTimer = null;
  }, 300);
}

function _getIndexedDB() {
  if (_indexedDB) return _indexedDB;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('SyncEventDB', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('snapshots');
    };
    req.onsuccess = () => {
      _indexedDB = req.result;
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

async function _flushToIndexedDB(database) {
  try {
    const idb = await _getIndexedDB();
    const data = database.export();
    const tx = idb.transaction('snapshots', 'readwrite');
    const store = tx.objectStore('snapshots');
    store.put(data, 'sdb-snapshot');
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (_) {}
}

async function _restoreFromIndexedDB(SQL) {
  try {
    const idb = await _getIndexedDB();
    const tx = idb.transaction('snapshots', 'readonly');
    const store = tx.objectStore('snapshots');
    const req = store.get('sdb-snapshot');
    return new Promise((resolve) => {
      req.onsuccess = () => {
        if (req.result) {
          try {
            const database = new SQL.Database(new Uint8Array(req.result));
            resolve(database);
          } catch (_) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

function _initTables(database) {
  const tables = ['syncEventQueue', 'syncDeviceLog', 'usuarios', 'suite', 'tbl_demandas', 'tarefas', 'tbl_clientes', 'tbl_roteiros', 'tbl_coletas', 'data_registry', 'tbl_ecopontos', 'tbl_modulos'];
  for (const name of tables) {
    database.run(`CREATE TABLE IF NOT EXISTS [${name}] (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  }
}

function _wrapDb(database) {
  return {
    transaction(storeNames, mode) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const txObj = { _db: database, _mode: mode, _error: null, oncomplete: null, onerror: null };
      txObj.objectStore = function(name) {
        if (!names.includes(name)) throw new Error(`Store ${name} not in transaction scope`);
        return _makeStore(database, name, txObj);
      };
      setTimeout(() => { if (txObj.oncomplete) txObj.oncomplete({ target: txObj }); }, 0);
      return txObj;
    }
  };
}

function _makeStore(database, storeName) {
  const esc = `[${storeName}]`;
  return {
    put(value) {
      const id = _deriveKey(value, storeName);
      database.run(`INSERT OR REPLACE INTO ${esc} (id, data) VALUES (?, ?)`, [String(id), JSON.stringify(value)]);
      _scheduleFlush();
      return _makeReq(id);
    },
    get(id) {
      const key = _normalizeKey(id);
      try {
        const rows = database.exec(`SELECT data FROM ${esc} WHERE id = ? LIMIT 1`, [key]);
        if (rows.length && rows[0].values.length) return _makeReq(JSON.parse(rows[0].values[0][0]));
      } catch (_) {}
      return _makeReq(null);
    },
    delete(id) {
      database.run(`DELETE FROM ${esc} WHERE id = ?`, [String(id)]);
      _scheduleFlush();
      return _makeReq(undefined);
    },
    getAll(query) {
      return _getAll(database, esc, storeName, query);
    },
    index(name) {
      return {
        getAll: (query) => _indexGetAll(database, esc, storeName, name, query),
        openCursor: (range, direction) => _openCursor(database, esc, storeName, name, range, direction),
        get: () => _makeReq(null)
      };
    }
  };
}

function _deriveKey(value, storeName) {
  if (value.id !== undefined) return value.id;
  if (value.tipo !== undefined && value.chave !== undefined) return `${value.tipo}_${value.chave}`;
  if (value.device_id !== undefined && value.seq !== undefined) return `${value.device_id}_${value.seq}`;
  return uuidv7();
}

function _normalizeKey(id) {
  if (id === null || id === undefined) return '';
  if (typeof id === 'object' && Array.isArray(id)) return id.join('_');
  if (typeof id === 'object' && id.lower !== undefined) return id.lower;
  return String(id);
}

function _getAll(database, esc, storeName, query) {
  let rows;
  if (query === undefined || query === null) {
    rows = database.exec(`SELECT data FROM ${esc}`);
  } else if (typeof query === 'object' && query.lower !== undefined) {
    rows = database.exec(`SELECT data FROM ${esc} WHERE id >= ? AND id <= ?`, [String(query.lower), String(query.upper)]);
  } else {
    rows = database.exec(`SELECT data FROM ${esc} WHERE id = ?`, [String(query)]);
  }
  return _rowsToReq(rows);
}

function _indexGetAll(database, esc, storeName, indexName, query) {
  let filterVal = null, lower = null, upper = null;
  if (query !== null && query !== undefined) {
    if (typeof query === 'object' && query.lower !== undefined) { lower = query.lower; upper = query.upper; }
    else if (typeof query === 'object' && query.length === 2) { lower = query[0]; upper = query[1]; }
    else { filterVal = query; }
  }
  try {
    let rows;
    if (filterVal !== null) {
      const fv = String(filterVal).replace(/'/g, "''");
      rows = database.exec(`SELECT data FROM ${esc} WHERE json_extract(data, '$.${indexName}') = '${fv}'`);
    } else if (lower !== null) {
      const l = String(lower).replace(/'/g, "''");
      const u = String(upper).replace(/'/g, "''");
      rows = database.exec(`SELECT data FROM ${esc}`);
    } else {
      rows = database.exec(`SELECT data FROM ${esc}`);
    }
    if (rows && rows.length && rows[0].values.length) {
      const all = rows[0].values.map(r => JSON.parse(r[0]));
      if (filterVal !== null) return _makeReq(all);
      if (lower !== null) {
        const lv = Array.isArray(lower) ? lower : [lower];
        const uv = Array.isArray(upper) ? upper : [upper];
        const filtered = all.filter(r => {
          const v = r[indexName];
          if (!v) return false;
          if (Array.isArray(v)) {
            for (let i = 0; i < Math.min(v.length, lv.length); i++) {
              if (v[i] < lv[i] || v[i] > uv[i]) return false;
            }
            return true;
          }
          return v >= lv[0] && v <= uv[0];
        });
        return _makeReq(filtered);
      }
      return _makeReq(all);
    }
  } catch (_) {
    const rows = database.exec(`SELECT data FROM ${esc}`);
    if (rows && rows.length && rows[0].values.length) {
      const all = rows[0].values.map(r => JSON.parse(r[0]));
      const filtered = filterVal !== null ? all.filter(r => String(r[indexName]) === String(filterVal)) : all;
      return _makeReq(filtered);
    }
  }
  return _makeReq([]);
}

function _openCursor(database, esc, storeName, indexName, range, direction) {
  try {
    let rows;
    if (range && range.lower !== undefined) {
      const l = String(range.lower).replace(/'/g, "''");
      const u = String(range.upper).replace(/'/g, "''");
      const dir = direction === 'prev' ? 'DESC' : 'ASC';
      rows = database.exec(`SELECT data FROM ${esc} ORDER BY id ${dir}`);
    } else if (range) {
      const val = String(range).replace(/'/g, "''");
      const dir = direction === 'prev' ? 'DESC' : 'ASC';
      rows = database.exec(`SELECT data FROM ${esc} ORDER BY id ${dir}`);
    } else {
      rows = database.exec(`SELECT data FROM ${esc}`);
    }
    if (rows && rows.length && rows[0].values.length) {
      const records = rows[0].values.map(r => JSON.parse(r[0]));
      if (range) {
        const l = range.lower !== undefined ? String(range.lower) : String(range);
        const filtered = records.filter(r => String(r[indexName]) >= (range.lower !== undefined ? String(range.lower) : String(range)));
        return _makeCursorReq(filtered);
      }
      return _makeCursorReq(records);
    }
  } catch (_) {}
  return _makeReq(null);
}

function _rowsToReq(rows) {
  if (rows && rows.length && rows[0].values.length) {
    return _makeReq(rows[0].values.map(r => JSON.parse(r[0])));
  }
  return _makeReq([]);
}

function _makeCursorReq(records) {
  let idx = 0;
  const cursor = {
    value: records.length > 0 ? records[0] : null,
    _records: records,
    _idx: 0,
    continue() {
      this._idx++;
      this.value = this._idx < this._records.length ? this._records[this._idx] : null;
    }
  };
  return _makeReq(cursor);
}

function _makeReq(result) {
  const req = { result, onsuccess: null, onerror: null };
  setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
  return req;
}

export async function openSyncEventDB() {
  if (_db) return _db;
  const init = typeof initSqlJs === 'function' ? initSqlJs : (await import('sql.js')).default;
  _sql = await init();
  let database = await _restoreFromIndexedDB(_sql);
  if (database) {
    console.log('[SyncEventDB] Restaurado snapshot do IndexedDB');
  } else {
    database = new _sql.Database();
  }
  _initTables(database);
  _activeDb = database;
  _db = _wrapDb(database);
  return _db;
}

export function closeSyncEventDB() {
  if (_activeDb) {
    _flushToIndexedDB(_activeDb);
  }
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  _db = null;
  _sql = null;
  _activeDb = null;
}
