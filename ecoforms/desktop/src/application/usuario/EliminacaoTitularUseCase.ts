import type { SqlitePort } from '../ports/SqlitePort';
import type { FileStoragePort } from '../ports/FileStoragePort';
import { supabase } from '../../infrastructure/persistence/supabase/supabaseClient';
import { USUARIO_MAPEAMENTO_SUPABASE, MAPEAMENTO_USUARIO_DELETE, USUARIO_DELETE } from '../../infrastructure/persistence/sqlite/queries/usuarios';
import { AGENDAMENTOS_DELETE_BY_USER } from '../../infrastructure/persistence/sqlite/queries/service';
import { MANIFESTACOES_DELETE_BY_CLIENTE } from '../../infrastructure/persistence/sqlite/queries/manifestacoes';
import { TAREFAS_DELETE_BY_USER } from '../../infrastructure/persistence/sqlite/queries/tarefas';
import { LOG_ACOES_DELETE_BY_USER } from '../../infrastructure/persistence/sqlite/queries/log_acoes';
import { LOG_AUDITORIA_DELETE_BY_USER } from '../../infrastructure/persistence/sqlite/queries/log_auditoria';

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
            USUARIO_MAPEAMENTO_SUPABASE.sql,
            [userId],
        ).catch(() => []);
        const supabaseId = mapRows[0]?.id_supabase ?? null;

        // 2 — Cascade local
        const deletes: Array<[string, string, unknown[]]> = [
            [AGENDAMENTOS_DELETE_BY_USER.sql, 'tbl_agendamentos', [userId, userId]],
            [MANIFESTACOES_DELETE_BY_CLIENTE.sql, 'manifestacoes', [userId]],
            [TAREFAS_DELETE_BY_USER.sql, 'tarefas', [userId, userId]],
            [LOG_ACOES_DELETE_BY_USER.sql, 'log_acoes', [userId]],
            [LOG_AUDITORIA_DELETE_BY_USER.sql, 'log_auditoria', [userId]],
            [MAPEAMENTO_USUARIO_DELETE.sql, 'mapeamento_usuarios_supabase', [userId]],
            [USUARIO_DELETE.sql, 'usuarios', [userId]],
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

        // 4 — Supabase profiles (public.profiles)
        let supabasePerfilRemovido = false;
        if (supabaseId && supabase) {
            try {
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
