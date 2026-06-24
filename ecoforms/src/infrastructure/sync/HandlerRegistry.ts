// ⚠️ ESPELHO de www/js/sync/HandlerRegistry.js
// Alterações aqui devem ser refletidas lá.
import type { SqlitePort } from '../../application/ports/SqlitePort';
import type { InboundService } from './InboundService';
import type { EventEnvelope } from './EventEnvelope';
import { ModuleSyncHandler } from './module/ModuleSyncHandler';

let _createTaskRemocao: ((input: {
    titulo: string;
    criadoPor: string;
    projetoId: string;
    descricao: string;
    prioridade: 'baixa' | 'media' | 'alta';
    setorId: string;
}) => Promise<{ id: string }>) | null = null;

export function setCreateTaskRemocao(fn: typeof _createTaskRemocao): void {
    _createTaskRemocao = fn;
}

const CAIXAS_TYPES: Record<string, string> = {
    '1': 'Entulho', '2': 'Madeira', '3': 'Poda',
    '4': 'Reciclável', '5': 'Rejeito', '6': 'Sucata', '7': 'Vidro',
};

interface CaixasData {
    ecoponto_id: string;
    ecopontoLabel?: string;
    caixas_list?: {
        ocupacao: Record<string, string>;
        removidas: Record<string, boolean>;
    };
    ecoponto?: string;
    inspecao?: {
        ecoponto?: { id: string; nome?: string };
        ocupacao?: {
            caixas?: Array<{ id: number; nome: string; nivel: number }>;
        };
    };
}

function extractCaixasData(conteudo: unknown): CaixasData | null {
    if (typeof conteudo === 'string') {
        try { return JSON.parse(conteudo) as CaixasData; } catch { return null; }
    }
    if (typeof conteudo === 'object' && conteudo !== null) {
        return conteudo as CaixasData;
    }
    return null;
}

async function handleEcopontoCaixasForm(db: SqlitePort, env: EventEnvelope): Promise<void> {
    if (!_createTaskRemocao) return;

    const d = env.data as Record<string, unknown>;
    const data = extractCaixasData(d.conteudo);
    if (!data) return;

    const ecopontoId = data.ecoponto_id || data.ecoponto || data.inspecao?.ecoponto?.id || '';
    const ecopontoLabel = data.ecopontoLabel || data.inspecao?.ecoponto?.nome || ecopontoId;
    const caixasList = data.caixas_list || { ocupacao: {}, removidas: {} };
    const ocupacao = caixasList.ocupacao || {};
    const removidas = caixasList.removidas || {};
    const deviceId = (env.source?.device_id || d.criado_por || 'sistema') as string;

    const tipTitle = (caixaId: string): string => {
        const tipo = CAIXAS_TYPES[caixaId] || `Caixa ${caixaId}`;
        const nivel = ocupacao[caixaId] || '0';
        return `${tipo} ${nivel}% — ${ecopontoLabel}`;
    };

    for (const caixaId of Object.keys(CAIXAS_TYPES)) {
        const nivelStr = ocupacao[caixaId];
        const nivel = nivelStr ? parseInt(nivelStr, 10) : 0;
        const removida = removidas[caixaId] === true || String(removidas[caixaId]) === 'true';

        if (nivel >= 75 && !removida) {
            const dedupKey = `ecoponto_${ecopontoId}_caixa_${caixaId}`;
            const existing = await db.query<{ id: string }>(
                `SELECT id FROM tarefas
                 WHERE projeto_id = 'caixas-ecoponto'
                 AND status != 'concluido'
                 AND carga = ?`,
                [dedupKey],
            );

            if (existing.length > 0) {
                await db.execute(
                    `UPDATE tarefas SET descricao = ? WHERE id = ?`,
                    [`${nivel}% — ${new Date().toISOString()}`, existing[0].id],
                );
                continue;
            }

            try {
                const prioridade = nivel >= 100 ? 'alta' as const : 'media' as const;
                await _createTaskRemocao({
                    titulo: tipTitle(caixaId),
                    criadoPor: deviceId,
                    projetoId: 'caixas-ecoponto',
                    descricao: JSON.stringify({
                        ecoponto_id: ecopontoId,
                        tipo_caixa: CAIXAS_TYPES[caixaId],
                        ocupacao: String(nivel),
                        caixa_id: Number(caixaId),
                        aviso_uuid: env.aggregate.id,
                    }),
                    prioridade,
                    setorId: 'setor-remocao',
                });
                await db.execute(
                    `UPDATE tarefas SET carga = ? WHERE projeto_id = 'caixas-ecoponto' AND titulo = ?`,
                    [dedupKey, tipTitle(caixaId)],
                );
            } catch (e) {
                console.warn('[HandlerRegistry] Failed to create remocao task:', e);
            }
        } else if ((nivel <= 50 && nivelStr !== undefined && nivelStr !== '') || removida) {
            await db.execute(
                `UPDATE tarefas SET status = 'concluido', atualizado_em = ?
                 WHERE projeto_id = 'caixas-ecoponto'
                 AND status != 'concluido'
                 AND carga = ?`,
                [env.time, `ecoponto_${ecopontoId}_caixa_${caixaId}`],
            );
        }
    }
}

export function registerAllHandlers(inbound: InboundService, db: SqlitePort): void {
    inbound.on('ecoforms.registro.criado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR REPLACE INTO registro_dados
             (id, tipo, chave, conteudo, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                env.aggregate.id,
                d.tipo ?? d.form_id ?? '',
                d.chave ?? env.aggregate.id,
                typeof d.conteudo === 'string' ? d.conteudo : JSON.stringify(d),
                d.criado_em ?? env.time,
                env.time,
            ],
        );

        if (d.tipo === 'ecopontoCaixasForm' || d.form_id === 'ecopontoCaixasForm') {
            handleEcopontoCaixasForm(db, env).catch(() => {});
        }
    });

    inbound.on('task.criada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR IGNORE INTO tarefas
             (id, titulo, descricao, status, prioridade, atribuido_para, demanda_id,
              suite_id, prazo, criado_por, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                env.aggregate.id,
                d.titulo ?? '',
                d.descricao ?? '',
                d.status ?? 'a_fazer',
                d.prioridade ?? 'media',
                d.atribuido_para ?? d.atribuidoPara ?? null,
                d.demanda_id ?? d.demandaId ?? null,
                d.suite_id ?? null,
                d.prazo ?? null,
                d.criado_por ?? env.source.device_id,
                d.criado_em ?? env.time,
                env.time,
            ],
        );
    });

    inbound.on('task.concluida', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const tarefaId = d.tarefa_id ?? d.tarefaId ?? env.aggregate.id;
        await db.execute(
            `UPDATE tarefas SET status = 'concluido', atualizado_em = ? WHERE id = ?`,
            [env.time, tarefaId],
        );
    });

    inbound.on('task.movida', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const tarefaId = d.tarefa_id ?? d.tarefaId ?? env.aggregate.id;
        const novoStatus = d.novo_status ?? d.novoStatus;
        if (!novoStatus) return;
        await db.execute(
            `UPDATE tarefas SET status = ?, atualizado_em = ? WHERE id = ?`,
            [novoStatus, env.time, tarefaId],
        );
    });

    inbound.on('task.arquivada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const tarefaId = d.tarefa_id ?? d.tarefaId ?? env.aggregate.id;
        await db.execute(
            `UPDATE tarefas SET arquivado = 1, atualizado_em = ? WHERE id = ?`,
            [env.time, tarefaId],
        );
    });

    inbound.on('task.desarquivada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const tarefaId = d.tarefa_id ?? d.tarefaId ?? env.aggregate.id;
        await db.execute(
            `UPDATE tarefas SET arquivado = 0, atualizado_em = ? WHERE id = ?`,
            [env.time, tarefaId],
        );
    });

    inbound.on('task.atualizada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const tarefaId = d.tarefaId ?? d.tarefa_id ?? env.aggregate.id;
        const fields: string[] = [];
        const values: unknown[] = [];
        if (d.titulo !== undefined) { fields.push('titulo = ?'); values.push(d.titulo); }
        if (d.descricao !== undefined) { fields.push('descricao = ?'); values.push(d.descricao); }
        if (d.status !== undefined) { fields.push('status = ?'); values.push(d.status); }
        if (d.prioridade !== undefined) { fields.push('prioridade = ?'); values.push(d.prioridade); }
        if (d.atribuidoPara !== undefined || d.atribuido_para !== undefined) { fields.push('atribuido_para = ?'); values.push(d.atribuidoPara ?? d.atribuido_para); }
        if (d.setorId !== undefined || d.setor_id !== undefined) { fields.push('setor_id = ?'); values.push(d.setorId ?? d.setor_id); }
        if (d.prazo !== undefined) { fields.push('prazo = ?'); values.push(d.prazo); }
        if (fields.length === 0) return;
        fields.push('atualizado_em = ?');
        values.push(env.time);
        values.push(tarefaId);
        await db.execute(`UPDATE tarefas SET ${fields.join(', ')} WHERE id = ?`, values);
    });

    inbound.on('task.excluida', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const tarefaId = d.tarefa_id ?? d.tarefaId ?? env.aggregate.id;
        await db.execute(`DELETE FROM tarefas WHERE id = ?`, [tarefaId]);
    });

    inbound.on('task.comentario_adicionado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const tarefaId = d.tarefa_id ?? d.tarefaId ?? env.aggregate.id;
        await db.execute(
            `INSERT INTO tarefas_comentarios (id, tarefa_id, usuario_id, comentario, criado_em)
             VALUES (?, ?, ?, ?, ?)`,
            [uuidv7(), tarefaId, d.usuario_id ?? env.source.device_id ?? 'system',
             d.comentario ?? '', env.time],
        );
    });

    inbound.on('demanda.aceita', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `UPDATE demandas
             SET status = 'aceita', aceito_por = ?, aceito_em = ?, atualizado_em = ?
             WHERE id = ? AND status = 'aberta'`,
            [d.aceito_por ?? d.aceitoPor ?? null, env.time, env.time, env.aggregate.id],
        );
    });

    inbound.on('usuario.criado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR IGNORE INTO usuarios
             (id, nome, nome_usuario, perfil, ativo, setor, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                env.aggregate.id,
                d.nome ?? '',
                d.username ?? '',
                d.perfil ?? 'operador',
                d.ativo !== false ? 1 : 0,
                d.setor ?? null,
                env.time,
                env.time,
            ],
        );
    });

    inbound.on('usuario.atualizado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const fields: string[] = [];
        const values: unknown[] = [];
        if (d.nome !== undefined) { fields.push('nome = ?'); values.push(d.nome); }
        if (d.perfil !== undefined) { fields.push('perfil = ?'); values.push(d.perfil); }
        if (d.ativo !== undefined) { fields.push('ativo = ?'); values.push(d.ativo ? 1 : 0); }
        if (d.setor !== undefined) { fields.push('setor = ?'); values.push(d.setor); }
        if (fields.length === 0) return;
        fields.push('atualizado_em = ?');
        values.push(env.time);
        values.push(env.aggregate.id);
        await db.execute(
            `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`,
            values,
        );
    });

    const moduleSyncHandler = new ModuleSyncHandler(db);
    moduleSyncHandler.register(inbound);

    // ── User Widget: created/updated ────────────────────────────────────────────
    inbound.on('instancias_widgets_usuario.created', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        if (!d?.id) return;
        await db.execute(
            `INSERT OR REPLACE INTO instancias_widgets_usuario
             (id, id_usuario, dashboard_id, tipo_widget, fonte_dados, config_exibicao,
              posicao_x, posicao_y, largura, altura, ordem_posicao,
              criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
            [d.id, d.user_id, d.dashboard_id, d.widget_type, d.data_source, d.display_config,
             d.position_x ?? 0, d.position_y ?? 0, d.position_w ?? 6, d.position_h ?? 1, d.position_order ?? 0, env.time],
        );
    });

    inbound.on('instancias_widgets_usuario.updated', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        if (!d?.id) return;
        await db.execute(
            `UPDATE instancias_widgets_usuario SET tipo_widget = ?, fonte_dados = ?, config_exibicao = ?,
             posicao_x = ?, posicao_y = ?, largura = ?, altura = ?, ordem_posicao = ?,
             atualizado_em = datetime('now') WHERE id = ?`,
            [d.widget_type, d.data_source, d.display_config,
             d.position_x ?? 0, d.position_y ?? 0, d.position_w ?? 6, d.position_h ?? 1, d.position_order ?? 0, d.id],
        );
    });

    inbound.on('instancias_widgets_usuario.deleted', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const id = d?.id ?? env.aggregate.id;
        if (!id) return;
        await db.execute(`DELETE FROM instancias_widgets_usuario WHERE id = ?`, [id]);
    });

    // ── Ouvidoria ───────────────────────────────────────────────────────────────
    inbound.on('manifestacao.criada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const id = d.id ?? env.aggregate.id;
        if (!id) return;
        const cols = Object.keys(d).join(', ');
        const placeholders = Object.keys(d).map(() => '?').join(', ');
        await db.execute(
            `INSERT OR IGNORE INTO manifestacoes (${cols}) VALUES (${placeholders})`,
            Object.values(d),
        );
    });

    inbound.on('manifestacao.status_atualizado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            'UPDATE manifestacoes SET status = ?, atualizado_em = ? WHERE id = ?',
            [d.status, env.time, env.aggregate.id],
        );
    });

    inbound.on('manifestacao.tramitacao_registrada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR IGNORE INTO tramitacoes
             (id, manifestacao_id, de_setor_id, para_setor_id, observacao, usuario_id, criado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [env.aggregate.id, d.manifestacao_id, d.de_setor_id ?? null,
             d.para_setor_id ?? null, d.observacao ?? null, d.usuario_id ?? null,
             d.criado_em ?? env.time],
        );
    });

    inbound.on('manifestacao.resposta_registrada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR IGNORE INTO respostas
             (id, manifestacao_id, texto, enviada_por, enviada_em)
             VALUES (?, ?, ?, ?, ?)`,
            [env.aggregate.id, d.manifestacao_id, d.texto ?? '',
             d.enviada_por ?? null, d.enviada_em ?? env.time],
        );
    });

    inbound.on('manifestacao.despacho_registrado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR IGNORE INTO despachos
             (id, manifestacao_id, texto, despachado_por, despachado_em)
             VALUES (?, ?, ?, ?, ?)`,
            [env.aggregate.id, d.manifestacao_id, d.texto ?? '',
             d.despachado_por ?? null, d.despachado_em ?? env.time],
        );
    });

    inbound.on('manifestacao.prazo_adicionado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR IGNORE INTO prazos
             (id, manifestacao_id, tipo_prazo_id, data_limite, status, criado_em)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [env.aggregate.id, d.manifestacao_id, d.tipo_prazo_id ?? d.tipo_prazo ?? '',
             d.data_limite ?? '', d.status ?? 'pendente', d.criado_em ?? env.time],
        );
    });

    inbound.on('manifestacao.classificada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `UPDATE manifestacoes
             SET subassunto_id = ?, subunidade_id = ?, programa_orcamentario_id = ?,
                 status = 'em_atendimento', atualizado_em = ?
             WHERE id = ?`,
            [d.subassuntoId ?? null, d.subunidadeId ?? null, d.programaOrcamentarioId ?? null,
             env.time, env.aggregate.id],
        );
    });

    inbound.on('manifestacao.competencia_verificada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `UPDATE manifestacoes
             SET competencia = ?, motivo_incompetencia = ?, orgao_destino = ?,
                 data_competencia = ?, atualizado_em = ?
             WHERE id = ?`,
            [d.competencia ?? 'pendente', d.motivo ?? null, d.orgaoDestino ?? null,
             env.time, env.time, env.aggregate.id],
        );
    });

    inbound.on('manifestacao.resposta_formatada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `UPDATE respostas
             SET resposta_formatada = 1, modelo_id = ?, data_revisao = ?
             WHERE id = ?`,
            [d.modeloId ?? null, env.time, d.respostaId ?? env.aggregate.id],
        );
        if (d.marcadaRespondida) {
            await db.execute(
                `UPDATE manifestacoes SET status = 'respondida', atualizado_em = ? WHERE id = ?`,
                [env.time, d.manifestacaoId ?? env.aggregate.id],
            );
        }
    });

    inbound.on('prazo.vencido', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `UPDATE prazos SET status = 'vencido', atualizado_em = ? WHERE id = ?`,
            [env.time, d.prazoId ?? env.aggregate.id],
        );
    });

    inbound.on('prazo.cobranca_enviada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `UPDATE prazos SET cobranca_enviada = 1, data_cobranca = ?, atualizado_em = ? WHERE id = ?`,
            [env.time, env.time, d.prazoId ?? env.aggregate.id],
        );
    });

    // ── Logística ───────────────────────────────────────────────────────────────
    inbound.on('roteiro.criado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
             `INSERT OR IGNORE INTO roteiros
              (id, nome, descricao, tipo_residuo_id, periodicidade, turno, base, distrito,
               situacao, criado_por, criado_em, atualizado_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
             [env.aggregate.id, d.nome ?? '', d.descricao ?? null, d.tipo_residuo_id ?? null,
             d.periodicidade ?? null, d.turno ?? null, d.base ?? null, d.distrito ?? null,
             d.situacao ?? 'ativo', d.criado_por ?? null, d.criado_em ?? env.time, env.time],
        );
    });

    inbound.on('roteiro.atualizado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `UPDATE roteiros SET nome = ?, descricao = ?, tipo_residuo_id = ?, periodicidade = ?,
             turno = ?, base = ?, distrito = ?, situacao = ?, atualizado_em = ?
             WHERE id = ?`,
            [d.nome, d.descricao ?? null, d.tipo_residuo_id ?? null, d.periodicidade ?? null,
             d.turno ?? null, d.base ?? null, d.distrito ?? null, d.situacao, env.time, env.aggregate.id],
        );
    });

    inbound.on('roteiro.excluido', async (env: EventEnvelope) => {
        await db.execute('DELETE FROM roteiros WHERE id = ?', [env.aggregate.id]);
    });

    inbound.on('execucao.criada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR IGNORE INTO execucao_coleta
             (id, roteiro_id, data_execucao, status, motorista_id, ajudante_id, veiculo,
              km_inicial, km_final, observacoes, inicio_em, fim_em, criado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [env.aggregate.id, d.roteiro_id, d.data_execucao, d.status ?? 'agendada',
             d.motorista_id ?? null, d.ajudante_id ?? null, d.veiculo ?? null,
             d.km_inicial ?? null, d.km_final ?? null, d.observacoes ?? null,
             d.inicio_em ?? null, d.fim_em ?? null, d.criado_em ?? env.time],
        );
    });

    inbound.on('execucao.status_atualizado', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const sets = ['status = ?', 'atualizado_em = ?'];
        const params: unknown[] = [d.status, env.time];
        if (d.fim_em !== undefined && d.fim_em !== null) {
            sets.push('fim_em = ?');
            params.push(d.fim_em);
        }
        params.push(env.aggregate.id);
        await db.execute(
            `UPDATE execucao_coleta SET ${sets.join(', ')} WHERE id = ?`,
            params,
        );
    });

    inbound.on('execucao.excluida', async (env: EventEnvelope) => {
        await db.execute('DELETE FROM execucao_coleta WHERE id = ?', [env.aggregate.id]);
    });

    inbound.on('intercorrencia.registrada', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR IGNORE INTO intercorrencias_coleta
             (id, execucao_id, tipo_ocorrencia_id, tipo_residuo_id, quantidade, descricao,
              latitude, longitude, endereco, resolvido, observacao, registrado_por, registrado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [env.aggregate.id, d.execucao_id, d.tipo_ocorrencia_id, d.tipo_residuo_id ?? null,
             d.quantidade ?? null, d.descricao ?? null, d.latitude ?? null, d.longitude ?? null,
             d.endereco ?? null, d.observacao ?? null, d.registrado_por ?? null,
             d.registrado_em ?? env.time, env.time],
        );
    });

    inbound.on('intercorrencia.resolvida', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `UPDATE intercorrencias_coleta SET
             resolvido = 1, resolvido_em = ?, resolvido_por = ?, resolvido_como = ?, atualizado_em = ?
             WHERE id = ?`,
            [d.resolvido_em ?? env.time, d.resolvido_por ?? null, d.resolvido_como ?? null,
             env.time, env.aggregate.id],
        );
    });

    // ADR-037: auditoria de turno — mobile publica, desktop persiste
    inbound.on('acesso.turno.log', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        await db.execute(
            `INSERT OR IGNORE INTO log_acesso_turno
             (id, usuario_id, escala_id, tipo, timestamp, dentro_turno,
              turno_inicio_calculado, turno_fim_calculado, dispositivo_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                env.aggregate.id,
                d.usuario_id ?? null,
                d.escala_id ?? null,
                d.tipo ?? 'login_ok',
                d.timestamp ?? env.time,
                d.dentro_turno ? 1 : 0,
                d.turno_inicio_calculado ?? null,
                d.turno_fim_calculado ?? null,
                d.dispositivo_id ?? null,
            ],
        );
    });
}
