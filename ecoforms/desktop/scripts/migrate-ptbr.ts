/**
 * Detector e executor de migração pt_br (ADR-006).
 *
 * Detecta banco legado verificando se a tabela `suite` ainda existe.
 * Se sim, executa as renomeações de tabelas e colunas.
 * Cada comando é isolado em try/catch — idempotente por design.
 */

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown[]>;
type ExecuteFn = (sql: string, params?: unknown[], options?: { bootstrap?: boolean }) => Promise<unknown>;

// Cada entrada: [tabela_ou_descricao, sql]
const MIGRATION_STEPS: [string, string][] = [
    // ── Tabelas ──────────────────────────────────────────────────────────────
    ['action_log → log_acoes',                 'ALTER TABLE action_log RENAME TO log_acoes'],
    ['log_acoes.action_id',                    'ALTER TABLE log_acoes RENAME COLUMN action_id TO id_acao'],
    ['log_acoes.target_type',                  'ALTER TABLE log_acoes RENAME COLUMN target_type TO tipo_alvo'],
    ['log_acoes.target_id',                    'ALTER TABLE log_acoes RENAME COLUMN target_id TO id_alvo'],
    ['log_acoes.user_id',                      'ALTER TABLE log_acoes RENAME COLUMN user_id TO id_usuario'],

    ['audit_log → log_auditoria',              'ALTER TABLE audit_log RENAME TO log_auditoria'],
    ['log_auditoria.actor_id',                 'ALTER TABLE log_auditoria RENAME COLUMN actor_id TO id_ator'],
    ['log_auditoria.actor_perfil',             'ALTER TABLE log_auditoria RENAME COLUMN actor_perfil TO perfil_ator'],
    ['log_auditoria.action',                   'ALTER TABLE log_auditoria RENAME COLUMN action TO acao'],
    ['log_auditoria.target_table',             'ALTER TABLE log_auditoria RENAME COLUMN target_table TO tabela_alvo'],
    ['log_auditoria.target_id',                'ALTER TABLE log_auditoria RENAME COLUMN target_id TO id_alvo'],
    ['log_auditoria.old_value',                'ALTER TABLE log_auditoria RENAME COLUMN old_value TO valor_anterior'],
    ['log_auditoria.new_value',                'ALTER TABLE log_auditoria RENAME COLUMN new_value TO valor_novo'],
    ['log_auditoria.metadata',                 'ALTER TABLE log_auditoria RENAME COLUMN metadata TO metadados'],
    ['log_auditoria.synced',                   'ALTER TABLE log_auditoria RENAME COLUMN synced TO sincronizado'],

    ['data_registry → registro_dados',         'ALTER TABLE data_registry RENAME TO registro_dados'],

    ['decision_registry → registro_decisoes',  'ALTER TABLE decision_registry RENAME TO registro_decisoes'],
    ['registro_decisoes.target_type',          'ALTER TABLE registro_decisoes RENAME COLUMN target_type TO tipo_alvo'],
    ['registro_decisoes.action',               'ALTER TABLE registro_decisoes RENAME COLUMN action TO acao'],
    ['registro_decisoes.enabled_when',         'ALTER TABLE registro_decisoes RENAME COLUMN enabled_when TO ativado_quando'],
    ['registro_decisoes.steps',                'ALTER TABLE registro_decisoes RENAME COLUMN steps TO passos'],
    ['registro_decisoes.params',               'ALTER TABLE registro_decisoes RENAME COLUMN params TO parametros'],
    ['registro_decisoes.consequence_type',     'ALTER TABLE registro_decisoes RENAME COLUMN consequence_type TO tipo_consequencia'],
    ['registro_decisoes.consequence_pattern',  'ALTER TABLE registro_decisoes RENAME COLUMN consequence_pattern TO padrao_consequencia'],
    ['registro_decisoes.consequence_config',   'ALTER TABLE registro_decisoes RENAME COLUMN consequence_config TO config_consequencia'],

    ['form_registry → registro_formularios',   'ALTER TABLE form_registry RENAME TO registro_formularios'],

    ['module_registry → registro_modulos',     'ALTER TABLE module_registry RENAME TO registro_modulos'],
    ['registro_modulos.name',                  'ALTER TABLE registro_modulos RENAME COLUMN name TO nome'],
    ['registro_modulos.description',           'ALTER TABLE registro_modulos RENAME COLUMN description TO descricao'],
    ['registro_modulos.entity_type',           'ALTER TABLE registro_modulos RENAME COLUMN entity_type TO tipo_entidade'],
    ['registro_modulos.version',               'ALTER TABLE registro_modulos RENAME COLUMN version TO versao'],
    ['registro_modulos.config',                'ALTER TABLE registro_modulos RENAME COLUMN config TO configuracao'],
    ['registro_modulos.suite_config',          'ALTER TABLE registro_modulos RENAME COLUMN suite_config TO config_suite'],

    ['view_registry → registro_visualizacoes', 'ALTER TABLE view_registry RENAME TO registro_visualizacoes'],
    ['registro_visualizacoes.module_type',     'ALTER TABLE registro_visualizacoes RENAME COLUMN module_type TO tipo_modulo'],
    ['registro_visualizacoes.user_id',         'ALTER TABLE registro_visualizacoes RENAME COLUMN user_id TO id_usuario'],
    ['registro_visualizacoes.is_template',     'ALTER TABLE registro_visualizacoes RENAME COLUMN is_template TO modelo'],

    ['sync_event_queue → fila_eventos_sync',   'ALTER TABLE sync_event_queue RENAME TO fila_eventos_sync'],
    ['fila_eventos_sync.type',                 'ALTER TABLE fila_eventos_sync RENAME COLUMN type TO tipo'],
    ['fila_eventos_sync.payload',              'ALTER TABLE fila_eventos_sync RENAME COLUMN payload TO carga'],
    ['fila_eventos_sync.aggregate_type',       'ALTER TABLE fila_eventos_sync RENAME COLUMN aggregate_type TO tipo_agregado'],
    ['fila_eventos_sync.aggregate_id',         'ALTER TABLE fila_eventos_sync RENAME COLUMN aggregate_id TO id_agregado'],
    ['fila_eventos_sync.correlation_id',       'ALTER TABLE fila_eventos_sync RENAME COLUMN correlation_id TO id_correlacao'],
    ['fila_eventos_sync.causation_id',         'ALTER TABLE fila_eventos_sync RENAME COLUMN causation_id TO id_causa'],
    ['fila_eventos_sync.seq',                  'ALTER TABLE fila_eventos_sync RENAME COLUMN seq TO sequencia'],
    ['fila_eventos_sync.status',               'ALTER TABLE fila_eventos_sync RENAME COLUMN status TO situacao'],
    ['fila_eventos_sync.attempts',             'ALTER TABLE fila_eventos_sync RENAME COLUMN attempts TO tentativas'],
    ['fila_eventos_sync.envelope_id',          'ALTER TABLE fila_eventos_sync RENAME COLUMN envelope_id TO id_envelope'],
    ['fila_eventos_sync.domain',               'ALTER TABLE fila_eventos_sync RENAME COLUMN domain TO dominio'],
    ['fila_eventos_sync.entity_id',            'ALTER TABLE fila_eventos_sync RENAME COLUMN entity_id TO id_entidade'],
    ['fila_eventos_sync.storage_path',         'ALTER TABLE fila_eventos_sync RENAME COLUMN storage_path TO caminho_storage'],
    ['fila_eventos_sync.sent_at',              'ALTER TABLE fila_eventos_sync RENAME COLUMN sent_at TO enviado_em'],

    ['sync_applied_log → log_eventos_aplicados', 'ALTER TABLE sync_applied_log RENAME TO log_eventos_aplicados'],
    ['log_eventos_aplicados.entity_type',      'ALTER TABLE log_eventos_aplicados RENAME COLUMN entity_type TO tipo_entidade'],
    ['log_eventos_aplicados.entity_id',        'ALTER TABLE log_eventos_aplicados RENAME COLUMN entity_id TO id_entidade'],
    ['log_eventos_aplicados.storage_path',     'ALTER TABLE log_eventos_aplicados RENAME COLUMN storage_path TO caminho_storage'],
    ['log_eventos_aplicados.source_device',    'ALTER TABLE log_eventos_aplicados RENAME COLUMN source_device TO dispositivo_origem'],
    ['log_eventos_aplicados.source_user',      'ALTER TABLE log_eventos_aplicados RENAME COLUMN source_user TO usuario_origem'],
    ['log_eventos_aplicados.applied_at',       'ALTER TABLE log_eventos_aplicados RENAME COLUMN applied_at TO aplicado_em'],

    ['sync_gap_log → log_gaps_sync',           'ALTER TABLE sync_gap_log RENAME TO log_gaps_sync'],
    ['log_gaps_sync.routing_id',               'ALTER TABLE log_gaps_sync RENAME COLUMN routing_id TO id_roteamento'],
    ['log_gaps_sync.missing_seq',              'ALTER TABLE log_gaps_sync RENAME COLUMN missing_seq TO sequencia_faltante'],
    ['log_gaps_sync.status',                   'ALTER TABLE log_gaps_sync RENAME COLUMN status TO situacao'],
    ['log_gaps_sync.attempts',                 'ALTER TABLE log_gaps_sync RENAME COLUMN attempts TO tentativas'],
    ['log_gaps_sync.resolved_at',              'ALTER TABLE log_gaps_sync RENAME COLUMN resolved_at TO resolvido_em'],
    ['log_gaps_sync.detected_at',              'ALTER TABLE log_gaps_sync RENAME COLUMN detected_at TO detectado_em'],

    ['sync_cursor → cursor_sync',              'ALTER TABLE sync_cursor RENAME TO cursor_sync'],
    ['cursor_sync.domain',                     'ALTER TABLE cursor_sync RENAME COLUMN domain TO dominio'],
    ['cursor_sync.last_synced_at',             'ALTER TABLE cursor_sync RENAME COLUMN last_synced_at TO ultimo_sync_em'],

    ['sync_manifest → manifesto_sync',         'ALTER TABLE sync_manifest RENAME TO manifesto_sync'],
    ['manifesto_sync.routing_id',              'ALTER TABLE manifesto_sync RENAME COLUMN routing_id TO id_roteamento'],
    ['manifesto_sync.seq',                     'ALTER TABLE manifesto_sync RENAME COLUMN seq TO sequencia'],
    ['manifesto_sync.last_event_id',           'ALTER TABLE manifesto_sync RENAME COLUMN last_event_id TO ultimo_id_evento'],

    ['sync_device_log → log_dispositivos_sync','ALTER TABLE sync_device_log RENAME TO log_dispositivos_sync'],
    ['log_dispositivos_sync.device_id',        'ALTER TABLE log_dispositivos_sync RENAME COLUMN device_id TO id_dispositivo'],
    ['log_dispositivos_sync.seq',              'ALTER TABLE log_dispositivos_sync RENAME COLUMN seq TO sequencia'],
    ['log_dispositivos_sync.event_id',         'ALTER TABLE log_dispositivos_sync RENAME COLUMN event_id TO id_evento'],
    ['log_dispositivos_sync.acked',            'ALTER TABLE log_dispositivos_sync RENAME COLUMN acked TO confirmado'],
    ['log_dispositivos_sync.pushed_at',        'ALTER TABLE log_dispositivos_sync RENAME COLUMN pushed_at TO enviado_em'],

    ['suite → pacotes',                        'ALTER TABLE suite RENAME TO pacotes'],
    ['pacotes.user_id',                        'ALTER TABLE pacotes RENAME COLUMN user_id TO id_usuario'],
    ['pacotes.sync_status',                    'ALTER TABLE pacotes RENAME COLUMN sync_status TO status_sinc'],
    ['pacotes.last_modified',                  'ALTER TABLE pacotes RENAME COLUMN last_modified TO ultima_modificacao'],
    ['pacotes.activity_id',                    'ALTER TABLE pacotes RENAME COLUMN activity_id TO id_atividade'],
    ['pacotes.task_id',                        'ALTER TABLE pacotes RENAME COLUMN task_id TO id_tarefa'],
    ['pacotes.package_id',                     'ALTER TABLE pacotes RENAME COLUMN package_id TO id_pacote'],
    ['pacotes.version_no',                     'ALTER TABLE pacotes RENAME COLUMN version_no TO num_versao'],
    ['pacotes.is_current',                     'ALTER TABLE pacotes RENAME COLUMN is_current TO atual'],
    ['pacotes.module_type',                    'ALTER TABLE pacotes RENAME COLUMN module_type TO tipo_modulo'],
    ['pacotes.resource_type',                  'ALTER TABLE pacotes RENAME COLUMN resource_type TO tipo_recurso'],
    ['pacotes.payload_json',                   'ALTER TABLE pacotes RENAME COLUMN payload_json TO carga_json'],
    ['pacotes.owner_id',                       'ALTER TABLE pacotes RENAME COLUMN owner_id TO id_proprietario'],
    ['pacotes.entity_id',                      'ALTER TABLE pacotes RENAME COLUMN entity_id TO id_entidade'],
    ['pacotes.entity_type',                    'ALTER TABLE pacotes RENAME COLUMN entity_type TO tipo_entidade'],
    ['pacotes.locked_by',                      'ALTER TABLE pacotes RENAME COLUMN locked_by TO bloqueado_por'],
    ['pacotes.locked_at',                      'ALTER TABLE pacotes RENAME COLUMN locked_at TO bloqueado_em'],
    ['pacotes.ref_package_id',                 'ALTER TABLE pacotes RENAME COLUMN ref_package_id TO ref_id_pacote'],
    ['pacotes.ref_package_ver',                'ALTER TABLE pacotes RENAME COLUMN ref_package_ver TO ref_versao_pacote'],
    ['pacotes.closed_at',                      'ALTER TABLE pacotes RENAME COLUMN closed_at TO fechado_em'],
    ['pacotes.last_envelope_id',               'ALTER TABLE pacotes RENAME COLUMN last_envelope_id TO ultimo_id_envelope'],
    ['pacotes.last_envelope_ts',               'ALTER TABLE pacotes RENAME COLUMN last_envelope_ts TO ultimo_envelope_em'],

    ['suite_historico → historico_pacotes',    'ALTER TABLE suite_historico RENAME TO historico_pacotes'],

    ['module_permissions → permissoes_modulos','ALTER TABLE module_permissions RENAME TO permissoes_modulos'],
    ['permissoes_modulos.profile',             'ALTER TABLE permissoes_modulos RENAME COLUMN profile TO perfil'],
    ['permissoes_modulos.can_view',            'ALTER TABLE permissoes_modulos RENAME COLUMN can_view TO pode_visualizar'],
    ['permissoes_modulos.can_create',          'ALTER TABLE permissoes_modulos RENAME COLUMN can_create TO pode_criar'],
    ['permissoes_modulos.can_edit',            'ALTER TABLE permissoes_modulos RENAME COLUMN can_edit TO pode_editar'],
    ['permissoes_modulos.can_approve',         'ALTER TABLE permissoes_modulos RENAME COLUMN can_approve TO pode_aprovar'],
    ['permissoes_modulos.can_delete',          'ALTER TABLE permissoes_modulos RENAME COLUMN can_delete TO pode_excluir'],

    ['module_visual_views → visuais_modulos',  'ALTER TABLE module_visual_views RENAME TO visuais_modulos'],
    ['visuais_modulos.visual_type',            'ALTER TABLE visuais_modulos RENAME COLUMN visual_type TO tipo_visual'],
    ['visuais_modulos.name',                   'ALTER TABLE visuais_modulos RENAME COLUMN name TO nome'],
    ['visuais_modulos.config',                 'ALTER TABLE visuais_modulos RENAME COLUMN config TO configuracao'],
    ['visuais_modulos.is_default',             'ALTER TABLE visuais_modulos RENAME COLUMN is_default TO padrao'],
    ['visuais_modulos.user_id',                'ALTER TABLE visuais_modulos RENAME COLUMN user_id TO id_usuario'],
    ['visuais_modulos.parent_view_id',         'ALTER TABLE visuais_modulos RENAME COLUMN parent_view_id TO id_visao_pai'],
    ['visuais_modulos.sync_status',            'ALTER TABLE visuais_modulos RENAME COLUMN sync_status TO status_sinc'],
    ['visuais_modulos.position',               'ALTER TABLE visuais_modulos RENAME COLUMN position TO posicao'],

    ['user_widget_instances → instancias_widgets_usuario', 'ALTER TABLE user_widget_instances RENAME TO instancias_widgets_usuario'],
    ['instancias_widgets_usuario.user_id',     'ALTER TABLE instancias_widgets_usuario RENAME COLUMN user_id TO id_usuario'],
    ['instancias_widgets_usuario.widget_type', 'ALTER TABLE instancias_widgets_usuario RENAME COLUMN widget_type TO tipo_widget'],

    ['role_hierarchy → hierarquia_perfis',     'ALTER TABLE role_hierarchy RENAME TO hierarquia_perfis'],
    ['permissions → permissoes',               'ALTER TABLE permissions RENAME TO permissoes'],
    ['supabase_user_map → mapeamento_usuarios_supabase', 'ALTER TABLE supabase_user_map RENAME TO mapeamento_usuarios_supabase'],

    // ── Colunas em tabelas que mantiveram o nome ──────────────────────────────
    ['usuarios.username',           'ALTER TABLE usuarios RENAME COLUMN username TO nome_usuario'],
    ['usuarios.password_hash',      'ALTER TABLE usuarios RENAME COLUMN password_hash TO hash_senha'],
    ['usuarios.sync_salt',          'ALTER TABLE usuarios RENAME COLUMN sync_salt TO sal_sync'],
    ['usuarios.org_id',             'ALTER TABLE usuarios RENAME COLUMN org_id TO id_organizacao'],

    ['tarefas.tags',                'ALTER TABLE tarefas RENAME COLUMN tags TO etiquetas'],
    ['tarefas.payload',             'ALTER TABLE tarefas RENAME COLUMN payload TO carga'],
    ['tarefas.location',            'ALTER TABLE tarefas RENAME COLUMN location TO localizacao'],
    ['tarefas.parent_task_id',      'ALTER TABLE tarefas RENAME COLUMN parent_task_id TO tarefa_pai_id'],
    ['tarefas.container_task_id',   'ALTER TABLE tarefas RENAME COLUMN container_task_id TO tarefa_container_id'],
    ['tarefas.cycle_id',            'ALTER TABLE tarefas RENAME COLUMN cycle_id TO id_ciclo'],
    ['tarefas.depends_on_task_id',  'ALTER TABLE tarefas RENAME COLUMN depends_on_task_id TO depende_tarefa_id'],
    ['tarefas.snap_version',        'ALTER TABLE tarefas RENAME COLUMN snap_version TO versao_snapshot'],
    ['tarefas.snap_hash',           'ALTER TABLE tarefas RENAME COLUMN snap_hash TO hash_snapshot'],
    ['tarefas.snap_frozen_at',      'ALTER TABLE tarefas RENAME COLUMN snap_frozen_at TO snapshot_congelado_em'],
    ['tarefas.form_registry_id',    'ALTER TABLE tarefas RENAME COLUMN form_registry_id TO id_formulario'],

    ['demanda_eventos.type',        'ALTER TABLE demanda_eventos RENAME COLUMN type TO tipo'],
    ['demanda_eventos.payload',     'ALTER TABLE demanda_eventos RENAME COLUMN payload TO carga'],
    ['demanda_eventos.device_id',   'ALTER TABLE demanda_eventos RENAME COLUMN device_id TO id_dispositivo'],
    ['demanda_eventos.user_id',     'ALTER TABLE demanda_eventos RENAME COLUMN user_id TO id_usuario'],

    ['demandas.arquivo_path',       'ALTER TABLE demandas RENAME COLUMN arquivo_path TO caminho_arquivo'],
    ['demandas.archive_status',     'ALTER TABLE demandas RENAME COLUMN archive_status TO status_arquivo'],
    ['demandas.last_envelope_id',   'ALTER TABLE demandas RENAME COLUMN last_envelope_id TO ultimo_id_envelope'],
    ['demandas.last_envelope_ts',   'ALTER TABLE demandas RENAME COLUMN last_envelope_ts TO ultimo_envelope_em'],

    ['tarefa_formularios.form_registry_id', 'ALTER TABLE tarefa_formularios RENAME COLUMN form_registry_id TO id_formulario'],
    ['tarefa_formularios.form_version',     'ALTER TABLE tarefa_formularios RENAME COLUMN form_version TO versao_formulario'],
    ['tarefa_formularios.form_snapshot',    'ALTER TABLE tarefa_formularios RENAME COLUMN form_snapshot TO snapshot_formulario'],

    ['execucao_coleta.despacho_id',    'ALTER TABLE execucao_coleta RENAME COLUMN despacho_id TO id_despacho'],
    ['execucao_coleta.despacho_codigo','ALTER TABLE execucao_coleta RENAME COLUMN despacho_codigo TO codigo_despacho'],

    ['anexos.blob_preview',         'ALTER TABLE anexos RENAME COLUMN blob_preview TO preview_blob'],
    ['anexos.storage_path',         'ALTER TABLE anexos RENAME COLUMN storage_path TO caminho_storage'],
    ['anexos.mime_type',            'ALTER TABLE anexos RENAME COLUMN mime_type TO tipo_mime'],
    ['anexos.storage_checksum',     'ALTER TABLE anexos RENAME COLUMN storage_checksum TO checksum_storage'],
];

async function isLegacySchema(query: QueryFn): Promise<boolean> {
    try {
        const rows = await query(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='suite' LIMIT 1`,
        ) as Array<{ name: string }>;
        return rows.length > 0;
    } catch {
        return false;
    }
}

export async function migratePtBrIfNeeded(
    query: QueryFn,
    execute: ExecuteFn,
): Promise<void> {
    const legacy = await isLegacySchema(query);
    if (!legacy) return;

    console.log('[migrate-ptbr] Schema legado detectado — iniciando migração pt_br...');

    await execute('PRAGMA foreign_keys = OFF', []);

    let ok = 0;
    let skipped = 0;
    for (const [label, sql] of MIGRATION_STEPS) {
        try {
            await execute(sql, []);
            ok++;
        } catch {
            // Coluna/tabela já renomeada ou não existe neste banco — idempotente
            skipped++;
            console.debug(`[migrate-ptbr] skip: ${label}`);
        }
    }

    await execute('PRAGMA foreign_keys = ON', []);

    console.log(`[migrate-ptbr] Concluído — ${ok} passos aplicados, ${skipped} ignorados.`);
}
