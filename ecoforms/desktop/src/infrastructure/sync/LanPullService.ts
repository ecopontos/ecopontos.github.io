import type { SqlitePort } from '../../application/ports/SqlitePort';
import type { LanDomainSyncService } from './LanDomainSyncService';
import type { LanIndexEntry } from '../storage/LanFileStorage';

export interface LanPullSummary {
    domains: Record<string, number>;
    totalIngested: number;
    durationMs: number;
    errors: string[];
}

type SnapshotJson = Record<string, unknown>;

interface DomainUpsertConfig {
    table: string;
    upsertSql: (snapshot: SnapshotJson) => { sql: string; params: unknown[] };
}

const DOMAIN_CONFIGS: Record<string, DomainUpsertConfig> = {
    tarefas: {
        table: 'tarefas',
        upsertSql: (s) => ({
            sql: `INSERT INTO tarefas (id, projeto_id, titulo, descricao, status, prioridade,
                    atribuido_para, criado_por, prazo, prazo_fim, tipo_prazo,
                    recorrencia, ordem, arquivado, id_formulario, suite_id,
                    demanda_id, setor_id, origem_tipo, origem_id, criado_em, atualizado_em)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
                  ON CONFLICT(id) DO UPDATE SET
                    titulo=excluded.titulo, descricao=excluded.descricao, status=excluded.status,
                    prioridade=excluded.prioridade, atribuido_para=excluded.atribuido_para,
                    prazo=excluded.prazo, prazo_fim=excluded.prazo_fim, tipo_prazo=excluded.tipo_prazo,
                    recorrencia=excluded.recorrencia, ordem=excluded.ordem, arquivado=excluded.arquivado,
                    id_formulario=excluded.id_formulario, suite_id=excluded.suite_id,
                    demanda_id=excluded.demanda_id, setor_id=excluded.setor_id,
                    origem_tipo=excluded.origem_tipo, origem_id=excluded.origem_id,
                    atualizado_em=datetime('now')`,
            params: [
                s.id, s.projeto_id ?? null, s.titulo, s.descricao ?? null,
                s.status, s.prioridade, s.atribuido_para ?? null, s.criado_por ?? null,
                s.prazo ?? null, s.prazo_fim ?? null, s.tipo_prazo ?? 'unico',
                s.recorrencia ?? null, s.ordem ?? 0, s.arquivado ? 1 : 0,
                s.id_formulario ?? null, s.suite_id ?? null,
                s.demanda_id ?? null, s.setor_id ?? null,
                s.origem_tipo ?? null, s.origem_id ?? null,
                s.criado_em ?? null,
            ],
        }),
    },
    demandas: {
        table: 'demandas',
        upsertSql: (s) => ({
            sql: `INSERT INTO demandas (id, origem_tipo, origem_id, solicitante_id, destinatario_id,
                    setor_id, tipo_acao, descricao, status, politica_conclusao, auto_aceite,
                    aceito_por, aceito_em, encerrado_por, encerrado_em, criado_em,
                    arquivada_em, caminho_arquivo, status_arquivo, atualizado_em)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
                  ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status, tipo_acao=excluded.tipo_acao, descricao=excluded.descricao,
                    aceito_por=excluded.aceito_por, aceito_em=excluded.aceito_em,
                    encerrado_por=excluded.encerrado_por, encerrado_em=excluded.encerrado_em,
                    arquivada_em=excluded.arquivada_em, caminho_arquivo=excluded.caminho_arquivo,
                    status_arquivo=excluded.status_arquivo, atualizado_em=datetime('now')`,
            params: [
                s.id, s.origem_tipo ?? null, s.origem_id ?? null,
                s.solicitante_id ?? null, s.destinatario_id ?? null,
                s.setor_id ?? null, s.tipo_acao ?? null, s.descricao ?? null,
                s.status ?? null, s.politica_conclusao ?? null,
                s.auto_aceite != null ? (s.auto_aceite as number) : 0,
                s.aceito_por ?? null, s.aceito_em ?? null,
                s.encerrado_por ?? null, s.encerrado_em ?? null,
                s.criado_em ?? null,
                s.arquivada_em ?? null, s.caminho_arquivo ?? null,
                s.status_arquivo ?? null,
            ],
        }),
    },
    agendamentos: {
        table: 'tbl_agendamentos',
        upsertSql: (s) => ({
            sql: `INSERT INTO tbl_agendamentos (id, slot_id, service_type_id, cliente_id, cliente_nome,
                    vagas_solicitadas, bairro, dados_formulario, status, task_id,
                    cliente_email, cliente_telefone, responsavel_id, setor_id,
                    criado_por, criado_em, atualizado_em)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
                  ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status, task_id=excluded.task_id,
                    dados_formulario=excluded.dados_formulario,
                    responsavel_id=excluded.responsavel_id, setor_id=excluded.setor_id,
                    atualizado_em=datetime('now')`,
            params: [
                s.id, s.slot_id ?? null, s.service_type_id ?? null,
                s.cliente_id ?? null, s.cliente_nome ?? null,
                s.vagas_solicitadas ?? 1, s.bairro ?? null,
                s.dados_formulario ?? null, s.status ?? null, s.task_id ?? null,
                s.cliente_email ?? null, s.cliente_telefone ?? null,
                s.responsavel_id ?? null, s.setor_id ?? null,
                s.criado_por ?? null, s.criado_em ?? null,
            ],
        }),
    },
    manifestacoes: {
        table: 'manifestacoes',
        upsertSql: (s) => ({
            sql: `INSERT INTO manifestacoes (id, protocolo, tipo_id, prioridade, status,
                    descricao, nome_manifestante, canal_entrada, setor_id, responsavel_id,
                    criado_em, atualizado_em)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
                  ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status, prioridade=excluded.prioridade,
                    responsavel_id=excluded.responsavel_id, setor_id=excluded.setor_id,
                    atualizado_em=datetime('now')`,
            params: [
                s.id, s.protocolo ?? null, s.tipo_id ?? null,
                s.prioridade ?? 'normal', s.status ?? 'aberta',
                s.descricao ?? null, s.nome_manifestante ?? null,
                s.canal_entrada ?? null, s.setor_id ?? null, s.responsavel_id ?? null,
                s.criado_em ?? null,
            ],
        }),
    },
    setores: {
        table: 'setores',
        upsertSql: (s) => ({
            sql: `INSERT INTO setores (id, nome, descricao, criado_em, atualizado_em)
                  VALUES (?,?,?,?,datetime('now'))
                  ON CONFLICT(id) DO UPDATE SET
                    nome=excluded.nome, descricao=excluded.descricao,
                    atualizado_em=datetime('now')`,
            params: [
                s.id, s.nome ?? null, s.descricao ?? null, s.criado_em ?? null,
            ],
        }),
    },
    usuarios: {
        table: 'usuarios',
        upsertSql: (s) => ({
            sql: `INSERT INTO usuarios (id, nome, nome_usuario, email, perfil, ativo, criado_em, atualizado_em)
                  VALUES (?,?,?,?,?,?,?,datetime('now'))
                  ON CONFLICT(id) DO UPDATE SET
                    nome=excluded.nome, nome_usuario=excluded.nome_usuario,
                    email=excluded.email, perfil=excluded.perfil, ativo=excluded.ativo,
                    atualizado_em=datetime('now')`,
            params: [
                s.id, s.nome ?? null, s.nome_usuario ?? s.username ?? null,
                s.email ?? null, s.perfil ?? 'operador', s.ativo != null ? (s.ativo as number) : 1,
                s.criado_em ?? null,
            ],
        }),
    },
};

const PULL_DOMAINS = Object.keys(DOMAIN_CONFIGS);

export class LanPullService {
    constructor(
        private readonly lan: LanDomainSyncService,
        private readonly sqlite: SqlitePort,
    ) {}

    async pullAll(): Promise<LanPullSummary> {
        const start = Date.now();
        const domains: Record<string, number> = {};
        const errors: string[] = [];
        let totalIngested = 0;

        for (const domain of PULL_DOMAINS) {
            try {
                const count = await this.pullDomain(domain);
                domains[domain] = count;
                totalIngested += count;
            } catch (e) {
                const msg = `[LanPull] ${domain}: ${e instanceof Error ? e.message : String(e)}`;
                console.warn(msg);
                errors.push(msg);
                domains[domain] = 0;
            }
        }

        const summary: LanPullSummary = {
            domains,
            totalIngested,
            durationMs: Date.now() - start,
            errors,
        };

        if (totalIngested > 0) {
            console.log(`[LanPull] ${totalIngested} entidades ingeridas em ${summary.durationMs}ms`, domains);
        }

        return summary;
    }

    async pullDomain(domain: string): Promise<number> {
        const config = DOMAIN_CONFIGS[domain];
        if (!config) return 0;

        const cursor = await this.getCursor(domain);
        const index = await this.lan.pullIndex(domain);
        if (!index) return 0;

        const changed: { entityId: string; entry: LanIndexEntry }[] = [];
        for (const [entityId, entry] of Object.entries(index.entities)) {
            if (entry.last_event_id > cursor) {
                changed.push({ entityId, entry });
            }
        }

        if (changed.length === 0) return 0;

        changed.sort((a, b) => a.entry.last_event_id.localeCompare(b.entry.last_event_id));

        let ingested = 0;
        let maxEventId = cursor;

        for (const { entityId, entry } of changed) {
            const snapshot = await this.lan.fetchEntity<SnapshotJson>(domain, entityId);
            if (!snapshot) continue;

            if (!snapshot.id) snapshot.id = entityId;

            const { sql, params } = config.upsertSql(snapshot);
            await this.sqlite.execute(sql, params);
            ingested++;

            if (entry.last_event_id > maxEventId) {
                maxEventId = entry.last_event_id;
            }
        }

        if (ingested > 0) {
            await this.setCursor(domain, maxEventId, ingested);
        }

        return ingested;
    }

    private async getCursor(domain: string): Promise<string> {
        const rows = await this.sqlite.query<{ last_event_id: string }>(
            `SELECT last_event_id FROM tbl_lan_sync_cursors WHERE domain = ? LIMIT 1`,
            [domain],
        );
        return rows[0]?.last_event_id ?? '';
    }

    private async setCursor(domain: string, lastEventId: string, count: number): Promise<void> {
        await this.sqlite.execute(
            `INSERT INTO tbl_lan_sync_cursors (domain, last_event_id, last_pulled_at, pulled_count)
             VALUES (?, ?, datetime('now'), ?)
             ON CONFLICT(domain) DO UPDATE SET
               last_event_id = excluded.last_event_id,
               last_pulled_at = excluded.last_pulled_at,
               pulled_count = pulled_count + excluded.pulled_count`,
            [domain, lastEventId, count],
        );
    }
}
