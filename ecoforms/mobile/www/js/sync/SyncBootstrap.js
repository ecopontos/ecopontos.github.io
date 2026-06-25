import { openSyncEventDB } from './SyncEventDB.js';

const DEFAULT_ORG_ID = 'ecoforms-org-001';
const DEFAULT_ORG_NAME = 'Organização EcoForms';

function createDefaultOrgConfig(deviceSectorId) {
  const setores = [
    { id: 'setor-admin', nome: 'Administração Geral', ativo: true },
    { id: 'setor-ambiente', nome: 'Meio Ambiente', ativo: true },
    { id: 'setor-coleta', nome: 'Coleta de Resíduos', ativo: true },
    { id: 'setor-fiscalizacao', nome: 'Fiscalização Ambiental', ativo: true },
  ];

  if (deviceSectorId && !setores.find(s => s.id === deviceSectorId)) {
    setores.push({ id: deviceSectorId, nome: `Setor ${deviceSectorId}`, ativo: true });
  }

  return {
    org_id: DEFAULT_ORG_ID,
    org_nome: DEFAULT_ORG_NAME,
    setores,
    updated_at: new Date().toISOString(),
  };
}

export class SyncBootstrap {
  constructor(storage) {
    this.storage = storage;
  }

  async bootstrap(deviceSectorId) {
    try {
      const blob = await this.storage.download('shared/org_config.json');
      const orgConfig = JSON.parse(await blob.text());
      const knownRoutingIds = orgConfig.setores
        .filter(s => s.ativo)
        .map(s => `${orgConfig.org_id}_${s.id}`);

      await this._cacheConfig(orgConfig);
      return { orgConfig, knownRoutingIds, created: false };
    } catch {
      const orgConfig = createDefaultOrgConfig(deviceSectorId);
      const knownRoutingIds = orgConfig.setores
        .filter(s => s.ativo)
        .map(s => `${orgConfig.org_id}_${s.id}`);

      try {
        await this.storage.upload(
          'shared/org_config.json',
          new TextEncoder().encode(JSON.stringify(orgConfig, null, 2))
        );
      } catch (uploadErr) {
        console.warn('[SyncBootstrap] Falha ao criar org_config.json no Storage:', uploadErr);
      }

      await this._cacheConfig(orgConfig);
      return { orgConfig, knownRoutingIds, created: true };
    }
  }

  async loadCachedConfig() {
    const db = await openSyncEventDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('data_registry', 'readonly');
      const store = tx.objectStore('data_registry');
      const request = store.get(['org_config', 'current']);
      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          resolve(JSON.parse(record.conteudo));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async _cacheConfig(config) {
    const db = await openSyncEventDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('data_registry', 'readwrite');
      const store = tx.objectStore('data_registry');
      store.put({
        tipo: 'org_config',
        chave: 'current',
        conteudo: JSON.stringify(config),
        atualizado_em: config.updated_at || new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
}
