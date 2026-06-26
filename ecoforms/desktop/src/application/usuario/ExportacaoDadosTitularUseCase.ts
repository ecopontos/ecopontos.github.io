import type { SqlitePort } from '../ports/SqlitePort';

const SQL_USUARIO = `SELECT id, nome, email, username, perfil, ativo, criado_em, atualizado_em FROM usuarios WHERE id = ?`;
const SQL_TAREFAS = `SELECT id, titulo, status, prioridade, prazo, criado_em, atualizado_em FROM tarefas WHERE criado_por = ? OR atribuido_para = ? ORDER BY criado_em DESC`;
const SQL_AGENDAMENTOS = `SELECT a.id, a.status, a.cliente_nome, a.vagas_solicitadas, a.criado_em, ss.titulo AS slot_titulo, ss.data_inicio, st.nome AS tipo_nome FROM tbl_agendamentos a JOIN tbl_service_slots ss ON ss.id = a.slot_id JOIN tbl_service_types st ON st.id = a.service_type_id WHERE a.cliente_id = ? OR a.criado_por = ? ORDER BY a.criado_em DESC`;
const SQL_MANIFESTACOES = `SELECT id, protocolo, tipo_id, situacao_id, solicitante_nome, criado_em FROM manifestacoes WHERE cliente_id = ? ORDER BY criado_em DESC`;
const SQL_LOG_ACOES = `SELECT id, id_acao, tipo_alvo, id_alvo, id_usuario, resultado, erro, criado_em FROM log_acoes WHERE id_usuario = ? ORDER BY criado_em DESC`;

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
            this.sqlite.query<Record<string, unknown>>(SQL_USUARIO, [userId]),
            this.sqlite.query<Record<string, unknown>>(SQL_TAREFAS, [userId, userId]),
            this.sqlite.query<Record<string, unknown>>(SQL_AGENDAMENTOS, [userId, userId]),
            this.sqlite.query<Record<string, unknown>>(SQL_MANIFESTACOES, [userId]),
            this.sqlite.query<Record<string, unknown>>(SQL_LOG_ACOES, [userId]),
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
