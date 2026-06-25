import type { SqlitePort } from '../ports/SqlitePort';
import { USUARIO_DADOS } from '../../infrastructure/persistence/sqlite/queries/usuarios';
import { TAREFAS_BY_USER } from '../../infrastructure/persistence/sqlite/queries/tarefas';
import { AGENDAMENTOS_BY_USER } from '../../infrastructure/persistence/sqlite/queries/service';
import { MANIFESTACOES_BY_CLIENTE } from '../../infrastructure/persistence/sqlite/queries/manifestacoes';
import { LOG_ACOES_BY_USER } from '../../infrastructure/persistence/sqlite/queries/log_acoes';

export interface DadosTitular {
    exportadoEm: string;
    usuario: Record<string, unknown> | null;
    tarefas: Record<string, unknown>[];
    agendamentos: Record<string, unknown>[];
    manifestacoes: Record<string, unknown>[];
    log_acoes: Record<string, unknown>[];
}

export class ExportacaoDadosTitularUseCase {
    constructor(private readonly sqlite: SqlitePort) {}

    async execute(userId: string, requestorRole: string): Promise<DadosTitular> {
        if (requestorRole !== 'admin') {
            throw new Error('Apenas administradores podem exportar dados de titulares.');
        }
        if (!userId?.trim()) throw new Error('userId é obrigatório.');

        const [usuarios, tarefas, agendamentos, manifestacoes, log_acoes] = await Promise.all([
            this.sqlite.query<Record<string, unknown>>(
                USUARIO_DADOS.sql,
                [userId],
            ),
            this.sqlite.query<Record<string, unknown>>(
                TAREFAS_BY_USER.sql,
                [userId, userId],
            ),
            this.sqlite.query<Record<string, unknown>>(
                AGENDAMENTOS_BY_USER.sql,
                [userId, userId],
            ),
            this.sqlite.query<Record<string, unknown>>(
                MANIFESTACOES_BY_CLIENTE.sql,
                [userId],
            ),
            this.sqlite.query<Record<string, unknown>>(
                LOG_ACOES_BY_USER.sql,
                [userId],
            ),
        ]);

        return {
            exportadoEm: new Date().toISOString(),
            usuario: usuarios[0] ?? null,
            tarefas,
            agendamentos,
            manifestacoes,
            log_acoes,
        };
    }
}
