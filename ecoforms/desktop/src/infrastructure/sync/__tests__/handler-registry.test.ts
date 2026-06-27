import { describe, expect, it, vi } from 'vitest';
import {
    ManifestacaoCriada,
    ManifestacaoStatusAtualizado,
} from '../../../domain/ouvidoria/ManifestacaoEvents';
import { registerAllHandlers } from '../HandlerRegistry';
import type { EcoFormsEventType, EventEnvelope } from '../EventEnvelope';
import type { InboundHandler, InboundService } from '../InboundService';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

const BASE_TIME = '2026-06-15T12:00:00.000Z';

function makeEnvelope(
    eventType: string,
    aggregateId: string,
    data: Record<string, unknown>,
): EventEnvelope {
    return {
        v: 2,
        id: 'event-1',
        type: eventType as EcoFormsEventType,
        source: {
            device_id: 'mobile-1',
            routing_id: 'setor-1',
            routing_type: 'setor',
            module: 'ecoforms-mobile',
            app_version: '1.0.0',
        },
        aggregate: { type: eventType.split('.')[0], id: aggregateId },
        time: BASE_TIME,
        schema_version: 1,
        seq: 1,
        prev_event_id: null,
        correlation_id: null,
        causation_id: null,
        stream_id: null,
        data,
        checksum: '',
    };
}

function firstCall(db: SqlitePort): [string, unknown[]] {
    return vi.mocked(db.execute).mock.calls[0] as [string, unknown[]];
}

function setup() {
    const handlers = new Map<string, InboundHandler>();
    const inbound = {
        on: vi.fn((eventType: string, handler: InboundHandler) => {
            handlers.set(eventType, handler);
        }),
    } as unknown as InboundService;
    const db = {
        execute: vi.fn(async () => {}),
        query: vi.fn(async () => []),
        all: vi.fn(async () => []),
        transaction: vi.fn(async <T>(callback: () => Promise<T>) => callback()),
    } as unknown as SqlitePort;

    registerAllHandlers(inbound, db);

    function getHandler(type: string): InboundHandler {
        const h = handlers.get(type);
        if (!h) throw new Error(`Handler não registrado para: ${type}`);
        return h;
    }

    return { db, handlers, getHandler };
}

// ── manifestacao.criada ─────────────────────────────────────────────────────

describe('HandlerRegistry manifestacao.criada', () => {
    it('inserts manifestacao building columns dynamically from payload', async () => {
        const { db, getHandler } = setup();

        await getHandler(ManifestacaoCriada)(makeEnvelope(ManifestacaoCriada, 'manifestacao-1', {
            protocolo: 'OUV-2026-001',
            tipo_id: 'tipo-1',
            origem_id: 'origem-1',
            classificacao_id: 'classificacao-1',
            situacao_id: 'situacao-1',
            assunto: 'Assunto',
            descricao: 'Descricao',
        }));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toContain('INSERT OR IGNORE INTO manifestacoes');
        expect(sql).toContain(
            '(protocolo, tipo_id, origem_id, classificacao_id, situacao_id, assunto, descricao)',
        );
        expect(params).toEqual([
            'OUV-2026-001',
            'tipo-1',
            'origem-1',
            'classificacao-1',
            'situacao-1',
            'Assunto',
            'Descricao',
        ]);
    });
});

// ── manifestacao.status_atualizado ─────────────────────────────────────────

describe('HandlerRegistry manifestacao.status_atualizado', () => {
    it('updates manifestacoes status', async () => {
        const { db, getHandler } = setup();

        await getHandler(ManifestacaoStatusAtualizado)(makeEnvelope(
            ManifestacaoStatusAtualizado, 'mani-1', { status: 'em_atendimento' },
        ));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toMatch(/UPDATE manifestacoes SET status = \?, atualizado_em = \? WHERE id = \?/);
        expect(params).toEqual(['em_atendimento', BASE_TIME, 'mani-1']);
    });
});

// ── manifestacao.tramitacao_registrada ─────────────────────────────────────

describe('HandlerRegistry tramitacao.registrada', () => {
    it('inserts into tramitacoes with manifestacao_id from payload', async () => {
        const { db, getHandler } = setup();

        await getHandler('tramitacao.registrada')(makeEnvelope(
            'tramitacao.registrada', 'tramit-1', {
                manifestacao_id: 'mani-2',
                de_setor_id: 'setor-a',
                para_setor_id: 'setor-b',
                observacao: 'Encaminhado',
                usuario_id: 'user-1',
            },
        ));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toContain('INSERT OR IGNORE INTO tramitacoes');
        expect(params[0]).toBe('tramit-1');
        expect(params[1]).toBe('mani-2');
        expect(params[2]).toBe('setor-a');
        expect(params[3]).toBe('setor-b');
    });

    it('uses null defaults for optional fields when missing', async () => {
        const { db, getHandler } = setup();

        await getHandler('tramitacao.registrada')(makeEnvelope(
            'tramitacao.registrada', 'tramit-2', { manifestacao_id: 'mani-3' },
        ));

        const [, params] = firstCall(db);
        expect(params[2]).toBeNull(); // de_setor_id
        expect(params[3]).toBeNull(); // para_setor_id
        expect(params[4]).toBeNull(); // observacao
    });
});

// ── manifestacao.resposta_registrada ───────────────────────────────────────

describe('HandlerRegistry resposta.registrada', () => {
    it('inserts into respostas', async () => {
        const { db, getHandler } = setup();

        await getHandler('resposta.registrada')(makeEnvelope(
            'resposta.registrada', 'resp-1', {
                manifestacao_id: 'mani-4',
                texto: 'Resposta ao solicitante',
                enviada_por: 'user-2',
            },
        ));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toContain('INSERT OR IGNORE INTO respostas');
        expect(params).toEqual(['resp-1', 'mani-4', 'Resposta ao solicitante', 'user-2', BASE_TIME]);
    });
});

// ── task.criada ────────────────────────────────────────────────────────────

describe('HandlerRegistry task.criada', () => {
    it('inserts task with all fields from payload', async () => {
        const { db, getHandler } = setup();

        await getHandler('task.criada')(makeEnvelope('task.criada', 'task-1', {
            titulo: 'Tarefa de teste',
            descricao: 'Desc',
            status: 'a_fazer',
            prioridade: 'alta',
            atribuido_para: 'user-3',
            demanda_id: 'demanda-1',
            suite_id: 'suite-1',
            prazo: '2026-12-31',
            criado_por: 'user-1',
            criado_em: '2026-06-17T10:00:00.000Z',
        }));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toContain('INSERT OR IGNORE INTO tarefas');
        expect(params[0]).toBe('task-1');
        expect(params[1]).toBe('Tarefa de teste');
        expect(params[4]).toBe('alta');
        expect(params[5]).toBe('user-3');
        expect(params[6]).toBe('demanda-1');
    });

    it('uses defaults when optional fields are missing', async () => {
        const { db, getHandler } = setup();

        await getHandler('task.criada')(makeEnvelope('task.criada', 'task-2', {
            titulo: 'Mínima',
        }));

        const [, params] = firstCall(db);
        expect(params[0]).toBe('task-2');
        expect(params[1]).toBe('Mínima');
        expect(params[2]).toBe('');           // descricao default
        expect(params[3]).toBe('a_fazer');    // status default
        expect(params[4]).toBe('media');      // prioridade default
        expect(params[5]).toBeNull();          // atribuido_para default
    });
});

// ── task.concluida ─────────────────────────────────────────────────────────

describe('HandlerRegistry task.concluida', () => {
    it('updates tarefas using tarefaId from payload', async () => {
        const { db, getHandler } = setup();

        await getHandler('task.concluida')(makeEnvelope('task.concluida', 'agg-1', {
            tarefaId: 'task-explicit',
        }));

        const [sql, params] = firstCall(db);
        expect(sql).toMatch(/UPDATE tarefas SET status = 'concluido'/);
        expect(params).toEqual([BASE_TIME, 'task-explicit']);
    });

    it('falls back to aggregate.id when tarefaId absent', async () => {
        const { db, getHandler } = setup();

        await getHandler('task.concluida')(makeEnvelope('task.concluida', 'task-from-agg', {}));

        const [, params] = firstCall(db);
        expect(params[1]).toBe('task-from-agg');
    });
});

// ── task.atualizada ────────────────────────────────────────────────────────

describe('HandlerRegistry task.atualizada', () => {
    it('updates tarefas status from payload', async () => {
        const { db, getHandler } = setup();

        await getHandler('task.atualizada')(makeEnvelope('task.atualizada', 'task-3', {
            tarefa_id: 'task-3',
            status: 'em_progresso',
        }));

        const [sql, params] = firstCall(db);
        expect(sql).toMatch(/UPDATE tarefas SET status = \?, atualizado_em = \? WHERE id = \?/);
        expect(params).toEqual(['em_progresso', BASE_TIME, 'task-3']);
    });
});

// ── demanda.aceita ─────────────────────────────────────────────────────────

describe('HandlerRegistry demanda.aceita', () => {
    it("updates demandas to 'aceita' with aceito_por from payload", async () => {
        const { db, getHandler } = setup();

        await getHandler('demanda.aceita')(makeEnvelope('demanda.aceita', 'demanda-1', {
            aceito_por: 'user-5',
        }));

        const [sql, params] = firstCall(db);
        expect(sql).toContain("SET status = 'aceita'");
        expect(params).toEqual(['user-5', BASE_TIME, BASE_TIME, 'demanda-1']);
    });

    it('sets aceito_por to null when absent', async () => {
        const { db, getHandler } = setup();

        await getHandler('demanda.aceita')(makeEnvelope('demanda.aceita', 'demanda-2', {}));

        const [, params] = firstCall(db);
        expect(params[0]).toBeNull();
    });
});

// ── usuario.atualizado ─────────────────────────────────────────────────────

describe('HandlerRegistry usuario.atualizado', () => {
    it('is a no-op when payload has no recognised fields', async () => {
        const { db, getHandler } = setup();

        await getHandler('usuario.atualizado')(makeEnvelope('usuario.atualizado', 'user-1', {}));

        expect(db.execute).not.toHaveBeenCalled();
    });

    it('updates nome when present in payload', async () => {
        const { db, getHandler } = setup();

        await getHandler('usuario.atualizado')(makeEnvelope('usuario.atualizado', 'user-2', {
            nome: 'Novo Nome',
        }));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toMatch(/UPDATE usuarios SET nome = \?, atualizado_em = \? WHERE id = \?/);
        expect(params).toEqual(['Novo Nome', BASE_TIME, 'user-2']);
    });

    it('updates perfil and ativo together', async () => {
        const { db, getHandler } = setup();

        await getHandler('usuario.atualizado')(makeEnvelope('usuario.atualizado', 'user-3', {
            perfil: 'gerente',
            ativo: true,
        }));

        const [sql, params] = firstCall(db);
        expect(sql).toContain('perfil = ?');
        expect(sql).toContain('ativo = ?');
        expect(params[0]).toBe('gerente');
        expect(params[1]).toBe(1);
    });
});

// ── ecoforms.registro.criado ───────────────────────────────────────────────

describe('HandlerRegistry ecoforms.registro.criado', () => {
    it('inserts into registro_dados using aggregate.id as primary key', async () => {
        const { db, getHandler } = setup();

        await getHandler('ecoforms.registro.criado')(makeEnvelope('ecoforms.registro.criado', 'reg-1', {
            tipo: 'inspecao',
            chave: 'chave-1',
            conteudo: '{"campo":"valor"}',
            setor: 'setor-a',
            criado_por: 'user-4',
        }));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toContain('INSERT OR REPLACE INTO registro_dados');
        expect(params[0]).toBe('reg-1');
        expect(params[1]).toBe('inspecao');
        expect(params[2]).toBe('chave-1');
        expect(params[3]).toBe('{"campo":"valor"}');
        // setor/criado_por não são colunas em registro_dados: apenas timestamps
        expect(params[4]).toBe(BASE_TIME);
        expect(params[5]).toBe(BASE_TIME);
    });

    it('serialises conteudo to JSON when it is an object', async () => {
        const { db, getHandler } = setup();

        const conteudo = { campo: 'valor' };
        await getHandler('ecoforms.registro.criado')(makeEnvelope('ecoforms.registro.criado', 'reg-2', {
            tipo: 'form',
            conteudo,
        }));

        const [, params] = firstCall(db);
        expect(typeof params[3]).toBe('string');
        // conteudo is missing from data when not a string, so JSON.stringify(d) is used
        expect(params[3]).toContain('"tipo"');
    });
});

// ── roteiro.criado ─────────────────────────────────────────────────────────

describe('HandlerRegistry roteiro.criado', () => {
    it('inserts into roteiros with nome and defaults', async () => {
        const { db, getHandler } = setup();

        await getHandler('roteiro.criado')(makeEnvelope('roteiro.criado', 'rot-1', {
            nome: 'Rota Norte',
            situacao: 'ativo',
            criado_por: 'user-1',
        }));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toContain('INSERT OR IGNORE INTO roteiros');
        expect(params[0]).toBe('rot-1');
        expect(params[1]).toBe('Rota Norte');
        expect(params[8]).toBe('ativo');
    });

    it('uses column tipo_residuo on insert', async () => {
        const { db, getHandler } = setup();

        await getHandler('roteiro.criado')(makeEnvelope('roteiro.criado', 'rot-2', {
            nome: 'Rota Sul',
            tipo_residuo: 'Reciclável',
        }));

        const [sql, params] = firstCall(db);
        expect(sql).toContain('tipo_residuo');
        expect(params[3]).toBe('Reciclável');
    });
});

// ── execucao.criada ────────────────────────────────────────────────────────

describe('HandlerRegistry execucao.criada', () => {
    it('inserts into execucao_coleta with roteiro_id and data_execucao', async () => {
        const { db, getHandler } = setup();

        await getHandler('execucao.criada')(makeEnvelope('execucao.criada', 'exec-1', {
            roteiro_id: 'rot-1',
            data_execucao: '2026-06-17',
            status: 'agendada',
            motorista_id: 'mot-1',
        }));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toContain('INSERT OR IGNORE INTO execucao_coleta');
        expect(params[0]).toBe('exec-1');
        expect(params[1]).toBe('rot-1');
        expect(params[2]).toBe('2026-06-17');
        expect(params[3]).toBe('agendada');
        expect(params[4]).toBe('mot-1');
    });

    it('uses status default when absent', async () => {
        const { db, getHandler } = setup();

        await getHandler('execucao.criada')(makeEnvelope('execucao.criada', 'exec-2', {
            roteiro_id: 'rot-2',
            data_execucao: '2026-06-18',
        }));

        const [, params] = firstCall(db);
        expect(params[3]).toBe('agendada');
    });
});

// ── roteiro.atualizado ─────────────────────────────────────────────────────

describe('HandlerRegistry roteiro.atualizado', () => {
    it('updates roteiros using tipo_residuo column', async () => {
        const { db, getHandler } = setup();

        await getHandler('roteiro.atualizado')(makeEnvelope('roteiro.atualizado', 'rot-1', {
            nome: 'Rota Atualizada',
            tipo_residuo: 'Madeira',
            situacao: 'ativo',
        }));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toMatch(/UPDATE roteiros SET nome = \?, descricao = \?, tipo_residuo = \?/);
        expect(sql).toContain('tipo_residuo');
        expect(params[0]).toBe('Rota Atualizada');
        expect(params[2]).toBe('Madeira');
        expect(params[7]).toBe('ativo');
        expect(params[9]).toBe('rot-1');
    });

    it('accepts tipo_residuo field directly when present', async () => {
        const { db, getHandler } = setup();

        await getHandler('roteiro.atualizado')(makeEnvelope('roteiro.atualizado', 'rot-2', {
            nome: 'Rota B',
            tipo_residuo: 'Reciclável',
            situacao: 'inativo',
        }));

        const [, params] = firstCall(db);
        expect(params[2]).toBe('Reciclável');
    });
});

// ── execucao.status_atualizado ─────────────────────────────────────────────

describe('HandlerRegistry execucao.status_atualizado', () => {
    it('updates execucao_coleta status', async () => {
        const { db, getHandler } = setup();

        await getHandler('execucao.status_atualizado')(makeEnvelope(
            'execucao.status_atualizado', 'exec-1', { status: 'em_execucao' },
        ));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toMatch(/UPDATE execucao_coleta SET status = \?, atualizado_em = \? WHERE id = \?/);
        expect(params).toEqual(['em_execucao', BASE_TIME, 'exec-1']);
    });
});

// ── intercorrencia.registrada ──────────────────────────────────────────────

describe('HandlerRegistry intercorrencia.registrada', () => {
    it('inserts into intercorrencias_coleta with required fields', async () => {
        const { db, getHandler } = setup();

        await getHandler('intercorrencia.registrada')(makeEnvelope(
            'intercorrencia.registrada', 'int-1', {
                execucao_id: 'exec-1',
                tipo_ocorrencia_id: 'tipo-1',
                descricao: 'Caixa danificada',
                registrado_por: 'user-5',
            },
        ));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toContain('INSERT OR IGNORE INTO intercorrencias_coleta');
        expect(params[0]).toBe('int-1');
        expect(params[1]).toBe('exec-1');
        expect(params[2]).toBe('tipo-1');
        expect(params[5]).toBe('Caixa danificada');
    });

    it('hardcodes resolvido=0 on insert', async () => {
        const { db, getHandler } = setup();

        await getHandler('intercorrencia.registrada')(makeEnvelope(
            'intercorrencia.registrada', 'int-2', {
                execucao_id: 'exec-2',
                tipo_ocorrencia_id: 'tipo-2',
            },
        ));

        const [sql] = firstCall(db);
        expect(sql).toContain(', 0, ');
    });
});

// ── intercorrencia.resolvida ───────────────────────────────────────────────

describe('HandlerRegistry intercorrencia.resolvida', () => {
    it('updates intercorrencias_coleta setting resolvido=1', async () => {
        const { db, getHandler } = setup();

        await getHandler('intercorrencia.resolvida')(makeEnvelope(
            'intercorrencia.resolvida', 'int-1', {
                resolvido_por: 'user-6',
                resolvido_como: 'Substituição da caixa',
            },
        ));

        expect(db.execute).toHaveBeenCalledOnce();
        const [sql, params] = firstCall(db);
        expect(sql).toContain('resolvido = 1');
        expect(params[1]).toBe('user-6');
        expect(params[2]).toBe('Substituição da caixa');
        expect(params[4]).toBe('int-1');
    });
});
