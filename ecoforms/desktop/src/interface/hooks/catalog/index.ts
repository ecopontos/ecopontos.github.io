/**
 * Catálogo de Hooks — ponto de entrada unificado
 *
 * Importe a partir do tema específico para melhor tree-shaking:
 *   import { useKanban } from '@/src/interface/hooks/catalog/kanban'
 *
 * Ou importe tudo de uma vez (menos recomendado em módulos grandes):
 *   import { useKanban } from '@/src/interface/hooks/catalog'
 *
 * Temas disponíveis:
 *   kanban        — Kanban, projetos, tarefas, métricas
 *   clientes      — Clientes PF/PJ, contatos
 *   manifestacoes — Manifestações (ouvidoria), tramitações, classificação
 *   logistica     — Roteiros, execuções, checklist, intercorrências
 *   sync          — Sincronização de eventos, dispositivo, conectividade
 *   auth          — Permissões RBAC, usuários, Supabase Admin
 *   data-registry — Tipos, itens e operações em lote no data registry
 *   modules-views — Módulos dinâmicos, views, widgets de dashboard
 *   forms         — Formulários, solicitações, submissões, demandas
 *   tauri         — Infraestrutura Tauri, SQLite, runtime detection
 *   utils         — Utilitários transversais (teclado, DI, CEP…)
 */

export * from './kanban';
export * from './clientes';
export * from './manifestacoes';
export * from './logistica';
export * from './sync';
export * from './auth';
export * from './data-registry';
export * from './modules-views';
export * from './forms';
export * from './tauri';
export * from './utils';
export * from './service';
