import { Task } from '../../domain/task/Task';
import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { TarefaFormulario } from '../../domain/demanda/TarefaFormulario';
import type { ClockPort } from '../ports/ClockPort';
import type { SyncOutbox } from '../ports/SyncOutboxPort';
import type { TaskCriadaPayload } from 'ecoforms-core/sync';
import { uuidv7 } from 'ecoforms-core';

export interface TaskProjectionFormulario {
    formRegistryId: string;
    formSnapshot:   Record<string, unknown>;
    formVersion?:   number;
    ordem:          number;
    obrigatorio:    boolean;
}

export interface TaskProjectionInput {
    titulo:         string;
    descricao?:     string;
    setorId:        string | null;
    atribuidoPara?: string;
    prazo?:         string;
    prioridade?:    'baixa' | 'media' | 'alta';
    criadoPor:      string;
    origemTipo:     TaskCriadaPayload['origem_tipo'];
    origemId:       string | null;
    formularios?:   TaskProjectionFormulario[];
}

export interface TaskProjectionOptions {
    formularioSaver?: (tf: TarefaFormulario) => Promise<void>;
    /**
     * Callback opcional para publicar o evento task.criada manualmente, no lugar do sync.write
     * automatico feito por project(). Necessario quando project() e chamado de dentro do
     * repo.transaction() de OUTRO caller (ex.: AcceptDemandaUseCase) — nesse caso a transaction()
     * interna de project() e transparentemente absorvida pela transacao externa ja aberta
     * (TauriSqliteAdapter reaproveita a mesma transacao em vez de abrir uma nova), entao o
     * sync.write automatico de project() ainda executaria dentro da transacao externa e travaria
     * o mutex estatico do adaptador. Quando fornecido, o chamador deve coletar os payloads aqui e
     * publica-los so depois que a SUA propria transacao externa tiver commitado.
     */
    onProjected?: (payload: TaskCriadaPayload) => void | Promise<void>;
}

export class TaskProjectionService {
    constructor(
        private readonly taskRepo:        TaskRepository,
        private readonly formularioSaver: (tf: TarefaFormulario) => Promise<void>,
        private readonly clock:           ClockPort,
        private readonly sync:            SyncOutbox,
    ) {}

    async project(input: TaskProjectionInput, options?: TaskProjectionOptions): Promise<string> {
        const saveFormulario = options?.formularioSaver ?? this.formularioSaver;
        const id    = uuidv7();
        const agora = this.clock.nowIso();

        await this.taskRepo.transaction(async (txTaskRepo) => {
            const ordem = await txTaskRepo.nextOrder(null, 'a_fazer');

            const task = Task.fromProps({
                id,
                titulo:        input.titulo,
                descricao:     input.descricao,
                status:        'a_fazer',
                prioridade:    input.prioridade ?? 'media',
                ordem,
                criadoPor:     input.criadoPor,
                projetoId:     null,
                atribuidoPara: input.atribuidoPara ?? null,
                prazo:         input.prazo ?? null,
                setorId:       input.setorId,
                origemTipo:    input.origemTipo,
                origemId:      input.origemId,
                arquivado:     false,
                criadoEm:      agora,
                atualizadoEm:  agora,
            });

            await txTaskRepo.save(task);

            for (const f of input.formularios ?? []) {
                await saveFormulario({
                    id:             uuidv7(),
                    tarefaId:       id,
                    formRegistryId: f.formRegistryId,
                    formVersion:    f.formVersion ?? 1,
                    formSnapshot:   f.formSnapshot,
                    ordem:          f.ordem,
                    obrigatorio:    f.obrigatorio,
                    concluido:      false,
                    concluidoEm:    null,
                });
            }
        });

        // Publicado depois que a transacao acima commitou: nunca fazer I/O de sync de dentro de
        // um callback de transaction() do SqlitePort — TauriSqliteAdapter.execute() nao reaproveita
        // a transacao ja aberta (so transaction() faz isso), entao uma chamada aninhada trava o
        // mutex estatico do adaptador esperando por ele mesmo. Publicar so apos o commit tambem
        // evita anunciar um evento para dados que ainda poderiam nao ter sido persistidos.
        const payload: TaskCriadaPayload = {
            id,
            titulo:         input.titulo,
            descricao:      input.descricao ?? null,
            status:         'a_fazer',
            prioridade:     input.prioridade ?? 'media',
            setor_id:       input.setorId,
            atribuido_para: input.atribuidoPara ?? null,
            prazo:          input.prazo ?? null,
            criado_por:     input.criadoPor,
            criado_em:      agora,
            origem_tipo:    input.origemTipo,
            origem_id:      input.origemId,
            formularios:    (input.formularios ?? []).map(f => ({
                formRegistryId: f.formRegistryId,
                ordem:          f.ordem,
                obrigatorio:    f.obrigatorio,
            })),
        };

        if (options?.onProjected) {
            await options.onProjected(payload);
        } else {
            await this.sync.write('task.criada', payload as unknown as Record<string, unknown>, {
                aggregateId: id,
                streamId:    input.origemId ?? id,
            });
        }

        return id;
    }
}
