import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('RBAC cross-runtime consistency', () => {
    it('window.ECOFORMS_RBAC (gerado) bate exatamente com o snapshot canônico do core', () => {
        const snapshotPath = path.resolve(__dirname, '../../packages/core/src/permissions/__snapshots__/rbac-matrix.json');
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

        const generatedPath = path.resolve(__dirname, '../www/js/rbac-matrix.generated.js');
        const sandbox = {};
        const fn = new Function('window', fs.readFileSync(generatedPath, 'utf-8') + '\nreturn window;');
        const window = fn(sandbox);

        expect(window.ECOFORMS_RBAC.ROLE_HIERARCHY).toEqual(snapshot.ROLE_HIERARCHY);
        expect(window.ECOFORMS_RBAC.PERMISSION_MATRIX).toEqual(snapshot.PERMISSION_MATRIX);
    });

    it('nenhuma role em PERMISSION_MATRIX é um ghost', () => {
        const snapshotPath = path.resolve(__dirname, '../../packages/core/src/permissions/__snapshots__/rbac-matrix.json');
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
        const GHOST_ROLES = ['superadmin', 'manager', 'user', 'guest'];

        for (const entry of Object.values(snapshot.PERMISSION_MATRIX)) {
            for (const role of entry.roles) {
                expect(GHOST_ROLES).not.toContain(role);
            }
        }
    });
});
