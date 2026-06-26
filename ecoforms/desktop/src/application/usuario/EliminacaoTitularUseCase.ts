import type { SqlitePort } from '../ports/SqlitePort';
import type { FileStoragePort } from '../ports/FileStoragePort';

const SQL_MAPEAMENTO = `SELECT id_supabase FROM mapeamento_usuarios_supabase WHERE local_id = ?`;
const SQL_DEL_AGENDAMENTOS = `DELETE FROM tbl_agendamentos WHERE cliente_id = ? OR criado_por = ?`;
const SQL_DEL_MANIFESTACOES = `DELETE FROM manifestacoes WHERE cliente_id = ?`;
const SQL_DEL_TAREFAS = `DELETE FROM tarefas WHERE criado_por = ? OR atribuido_para = ?`;
const SQL_DEL_LOG_ACOES = `DELETE FROM log_acoes WHERE id_usuario = ?`;
const SQL_DEL_LOG_AUDITORIA = `DELETE FROM log_auditoria WHERE id_ator = ?`;
const SQL_DEL_MAPEAMENTO = `DELETE FROM mapeamento_usuarios_supabase WHERE local_id = ?`;
const SQL_DEL_USUARIO = `DELETE FROM usuarios WHERE id = ?`;

export interface EliminacaoTitularResult {
    userId: string;
    tabelas: string[];
    storageRemovido: boolean;
    supabasePerfilRemovido: boolean;
    supabaseAuthRemovido: boolean;
    erros: string[];
}

export class EliminacaoTitularUseCase {
    constructor(
        private readonly sqlite: SqlitePort,
        private readonly fileStorage: FileStoragePort,
    ) {}

    async execute(userId: string, requestorRole: string): Promise<EliminacaoTitularResult> {
        if (requestorRole !== 'admin') {
            throw new Error('Apenas administradores podem eliminar dados de titulares.');
        }
        if (!userId?.trim()) throw new Error('userId é obrigatório.');

        const tabelas: string[] = [];
        const erros: string[] = [];

        // 1 — Obtém o supabase_id antes de deletar o mapeamento
        const mapRows = await this.sqlite.query<{ id_supabase: string }>(
            SQL_MAPEAMENTO,
            [userId],
        ).catch(() => []);
        const supabaseId = mapRows[0]?.id_supabase ?? null;

        // 2 — Cascade local
        const deletes: Array<[string, string, unknown[]]> = [
            [SQL_DEL_AGENDAMENTOS, 'tbl_agendamentos', [userId, userId]],
            [SQL_DEL_MANIFESTACOES, 'manifestacoes', [userId]],
            [SQL_DEL_TAREFAS, 'tarefas', [userId, userId]],
            [SQL_DEL_LOG_ACOES, 'log_acoes', [userId]],
            [SQL_DEL_LOG_AUDITORIA, 'log_auditoria', [userId]],
            [SQL_DEL_MAPEAMENTO, 'mapeamento_usuarios_supabase', [userId]],
            [SQL_DEL_USUARIO, 'usuarios', [userId]],
        ];

        for (const [sql, tabela, params] of deletes) {
            try {
                await this.sqlite.execute(sql, params);
                tabelas.push(tabela);
            } catch (e) {
                erros.push(`${tabela}: ${String(e)}`);
            }
        }

        // 3 — Storage: remove imagens do usuário
        let storageRemovido = false;
        try {
            const paths = await this.fileStorage.list('sync-bucket', `users/${userId}/images/`);
            if (paths.length > 0) {
                await this.fileStorage.remove('sync-bucket', paths);
            }
            storageRemovido = true;
        } catch (e) {
            erros.push(`storage: ${String(e)}`);
        }

        // 4 — Supabase profiles (public.profiles) — dynamic import to avoid static boundary violation
        let supabasePerfilRemovido = false;
        if (supabaseId) {
            try {
                const { supabase } = await import('../../infrastructure/persistence/supabase/supabaseClient');
                const { error } = await supabase.from('profiles').delete().eq('id', supabaseId);
                if (error) throw error;
                supabasePerfilRemovido = true;
            } catch (e) {
                erros.push(`profiles: ${String(e)}`);
            }
        }

        // 5 — Supabase Auth (via Tauri invoke — requer service role key)
        let supabaseAuthRemovido = false;
        if (supabaseId) {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                const resp = await invoke<{ success: boolean; message: string }>('supabase_admin_query', {
                    request: {
                        table: 'usuarios',
                        operation: 'delete_user',
                        user_id: userId,
                        payload: { supabase_id: supabaseId },
                    },
                });
                if (!resp.success) throw new Error(resp.message);
                supabaseAuthRemovido = true;
            } catch (e) {
                erros.push(`supabase_auth: ${String(e)}`);
            }
        }

        return { userId, tabelas, storageRemovido, supabasePerfilRemovido, supabaseAuthRemovido, erros };
    }
}
