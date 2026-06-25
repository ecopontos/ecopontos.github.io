import { beforeAll, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadScript(relativePath) {
    const fullPath = path.resolve(__dirname, relativePath);
    if (fs.existsSync(fullPath)) {
        eval(fs.readFileSync(fullPath, 'utf-8'));
    }
}

beforeAll(async () => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
  }

  if (!globalThis.indexedDB) {
    globalThis.indexedDB = {
      open() {
        const request = {};
        queueMicrotask(() => {
          request.result = {
            objectStoreNames: {
              contains: () => true,
            },
          };
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        });
        return request;
      },
    };
  }

  // Load utility dependencies
  loadScript('../www/js/utils/safe-json.js');
  loadScript('../www/js/utils/uuid.js');
  loadScript('../www/js/utils/date-utils.js');
  loadScript('../www/js/utils/professional-jsonb-builder.js');

  // Load module dependencies
  loadScript('../www/js/persistence/FormStore.js');
  loadScript('../www/js/sync/FormSyncService.js');
  loadScript('../www/js/services/FileUploadService.js');
  loadScript('../www/js/domain/EcopontoService.js');
  loadScript('../www/js/services/SchemaCacheService.js');

  // Load DataService (facade)
  loadScript('../www/js/data-service.js');
});

describe('DataService snapshot contract', () => {
  it('keeps payload minimal by excluding transport/control keys from dados', () => {
    const ds = new window.DataService();

    const payload = ds.extractFormData({
      activity_id: 'legacy-activity',
      task_id: 'task-canonical',
      submitted_at: '2026-01-01T10:00:00.000Z',
      status: 'submitted',
      uuid: 'r-002',
      form_type: 'vistoria',
      bairro: 'Centro',
      observacao: 'Tudo certo',
      _storagePaths: ['file://x'],
    });

    expect(payload.activity_id).toBeUndefined();
    expect(payload.task_id).toBeUndefined();
    expect(payload.submitted_at).toBeUndefined();
    expect(payload.status).toBeUndefined();
    expect(payload.uuid).toBeUndefined();

    expect(payload.bairro).toBe('Centro');
    expect(payload.observacao).toBe('Tudo certo');
    expect(payload._attachments).toEqual(['file://x']);
  });
});
