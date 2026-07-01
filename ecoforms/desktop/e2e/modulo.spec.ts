import { test, expect } from '@playwright/test';

const MOCK_MODULE = {
  id: 'mod-test-1',
  slug: 'teste',
  name: 'Módulo de Teste',
  description: 'Descrição do módulo de teste',
  entity_type: 'teste',
  icon: '🧪',
  color: null,
  prefix: 'TEST',
  ordem: 1,
  status: 'published',
  version: 1,
  config: JSON.stringify({
    forms: [{ form_id: 'form-1', required: true, default: true, order: 1 }],
    data_catalogs: [{ catalog_id: 'tipo-a', required: false }],
    views: [{ view_id: 'main', context: 'dashboard', order: 1 }],
    decisions: [],
  }),
  suite_config: null,
  criado_em: new Date().toISOString(),
  atualizado_em: new Date().toISOString(),
  publicado_em: new Date().toISOString(),
};

const MOCK_PERMISSIONS = [
  { profile: 'admin', can_view: 1, can_create: 1, can_edit: 1, can_approve: 1, can_delete: 1 },
];

const MOCK_FORM = {
  form_id: 'form-1',
  titulo: 'Formulário Teste',
  conteudo: JSON.stringify({ title: 'Formulário Teste' }),
};

const MOCK_DATA_REGISTRY = [
  { id: 'dr-1', nome: 'Item A', tipo: 'tipo-a' },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === 'db_connect') return;
        if (cmd === 'plugin:path|resolve_directory') return 'C:\\mock\\appData';
        if (cmd === 'plugin:path|join') return 'C:\\mock\\appData\\ecoforms.db';
        if (cmd === 'plugin:path|resolve') return 'C:\\mock\\appData\\ecoforms.db';
        if (cmd === 'plugin:sql|select') {
          const sql = (args?.sql as string) || '';
          const params = (args?.argumentsValues ?? []) as unknown[];

          if (sql.includes('registro_modulos WHERE slug =')) {
            return [MOCK_MODULE];
          }
          if (sql.includes('module_permissions WHERE module_id')) {
            return MOCK_PERMISSIONS;
          }
          if (sql.includes('registro_formularios WHERE form_id IN')) {
            return [MOCK_FORM];
          }
          if (sql.includes('registro_dados WHERE tipo =')) {
            return MOCK_DATA_REGISTRY;
          }
          if (sql.includes('usuarios WHERE')) {
            return [{ id: 'user-1', nome: 'Admin Teste', perfil: 'admin', setor: 'TI', ativo: 1, email: 'test@pmf.sc.gov.br', telefone: null }];
          }
          if (sql.includes('COUNT(*)')) {
            return [{ total: 0 }];
          }
          if (sql.includes('SELECT 1')) {
            return [{ 1: 1 }];
          }
          return [];
        }
        if (cmd === 'plugin:sql|execute') {
          return { rowsAffected: 1 };
        }
        // Fallback: don't throw, return undefined to avoid crashing app init
        console.warn(`[E2E Mock] Unhandled invoke: ${cmd}`, args);
        return undefined;
      },
    };
  });
});

test.describe('Rota /modulo/[slug]', () => {
  test('deve exibir o módulo publicado', async ({ page }) => {
    await page.goto('/modulo/teste');
    await expect(page.locator('h1')).toContainText('Módulo de Teste');
    await expect(page.locator('text=Descrição do módulo de teste')).toBeVisible();
    await expect(page.locator('text=Formulários (1)')).toBeVisible();
    await expect(page.locator('text=Catálogos de Dados (1)')).toBeVisible();
  });

  test('deve exibir badge published e versão', async ({ page }) => {
    await page.goto('/modulo/teste');
    await expect(page.locator('text=published')).toBeVisible();
    await expect(page.locator('text=v1')).toBeVisible();
  });

  test('deve mostrar mensagem de não encontrado para slug inexistente', async ({ page }) => {
    await page.goto('/modulo/inexistente');
    await expect(page.locator('text=Módulo não encontrado')).toBeVisible();
  });
});
