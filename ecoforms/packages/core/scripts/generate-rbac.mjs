#!/usr/bin/env node
/**
 * Gera os artefatos RBAC (Rust seed SQL, mobile window global, snapshot) a partir
 * da matriz canônica compilada em dist/permissions/rbac-matrix.js.
 * Pré-requisito: `tsc` já ter rodado (dist/ precisa existir). Chamado automaticamente
 * por `npm run build` neste pacote.
 */
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(coreRoot, '../..');

const rbacMatrixPath = path.join(coreRoot, 'dist/permissions/rbac-matrix.js');
const rbacMatrixUrl = pathToFileURL(rbacMatrixPath).href;

const { ROLE_HIERARCHY, PERMISSION_MATRIX, ROLE_METADATA } = await import(rbacMatrixUrl);

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

function buildPerfisInsert() {
  const rows = Object.entries(ROLE_METADATA)
    .map(([perfil, meta]) => `    ('${perfil}','${sqlEscape(meta.nome)}','${sqlEscape(meta.descricaoPerfil)}')`)
    .join(',\n');
  return `INSERT INTO perfis (id, nome, descricao) VALUES\n${rows};`;
}

function buildHierarquiaInsert() {
  const rows = Object.entries(ROLE_HIERARCHY)
    .map(([perfil, nivel]) => `    ('${perfil}',${nivel},'${sqlEscape(ROLE_METADATA[perfil].descricaoNivel)}')`)
    .join(',\n');
  return `INSERT INTO hierarquia_perfis (perfil, nivel, descricao) VALUES\n${rows};`;
}

function buildPermissoesInserts() {
  return Object.entries(PERMISSION_MATRIX)
    .map(([permissao, entry]) => {
      const rows = entry.roles.map((role) => `('${role}','${permissao}')`).join(',');
      return `INSERT INTO permissoes (perfil, permissao) VALUES ${rows};`;
    })
    .join('\n');
}

const sql = [
  '-- AUTO-GERADO por packages/core/scripts/generate-rbac.mjs — não editar manualmente.',
  '-- Fonte: packages/core/src/permissions/rbac-matrix.ts',
  '',
  buildPerfisInsert(),
  '',
  buildHierarquiaInsert(),
  '',
  buildPermissoesInserts(),
  '',
].join('\n');

const rustSeedPath = path.join(monorepoRoot, 'desktop/src-tauri/src/commands/rbac_seed.sql');
writeFileSync(rustSeedPath, sql, 'utf-8');
console.log(`[generate-rbac] escrito ${rustSeedPath}`);

const mobileJs = `// AUTO-GERADO por packages/core/scripts/generate-rbac.mjs — não editar manualmente.
(function () {
  window.ECOFORMS_RBAC = {
    ROLE_HIERARCHY: ${JSON.stringify(ROLE_HIERARCHY, null, 2)},
    PERMISSION_MATRIX: ${JSON.stringify(PERMISSION_MATRIX, null, 2)}
  };
})();
`;
const mobilePath = path.join(monorepoRoot, 'mobile/www/js/rbac-matrix.generated.js');
writeFileSync(mobilePath, mobileJs, 'utf-8');
console.log(`[generate-rbac] escrito ${mobilePath}`);

const snapshotDir = path.join(coreRoot, 'src/permissions/__snapshots__');
mkdirSync(snapshotDir, { recursive: true });
const snapshotPath = path.join(snapshotDir, 'rbac-matrix.json');
writeFileSync(snapshotPath, JSON.stringify({ ROLE_HIERARCHY, PERMISSION_MATRIX }, null, 2) + '\n', 'utf-8');
console.log(`[generate-rbac] escrito ${snapshotPath}`);
