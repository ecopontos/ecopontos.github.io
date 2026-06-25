import type { DemandaRepository } from '../../domain/demanda/DemandaRepository';
import type { Demanda } from '../../domain/demanda/Demanda';
import type { DemandaEvento } from '../../domain/demanda/DemandaEvento';
import type { TarefaFormulario } from '../../domain/demanda/TarefaFormulario';
import type { TaskRepository } from '../../domain/task/TaskRepository';

export interface DemandaStatusResult {
  demanda: Demanda;
  tarefas: Array<{
    id: string;
    titulo: string;
    status: string;
    atribuidoPara: string | null;
    formularios: TarefaFormulario[];
    progresso: { total: number; concluidos: number };
  }>;
  eventos: DemandaEvento[];
  progresso: { tarefasTotal: number; tarefasConcluidas: number };
}

export class GetDemandaStatusUseCase {
  constructor(
    private repo: DemandaRepository,
    private taskRepo: TaskRepository
  ) {}

  async execute(demandaId: string): Promise<DemandaStatusResult> {
    const demanda = await this.repo.findById(demandaId);
    if (!demanda) throw new Error(`Demanda ${demandaId} não encontrada`);

    const tarefasEntities = await this.taskRepo.findByDemandaId(demandaId);
    
    const tarefas = await Promise.all(
      tarefasEntities.map(async (tarefa) => {
        const formularios = await this.repo.findTarefaFormularios(tarefa.id);
        const concluidos = formularios.filter(f => f.concluido).length;
        return {
          id: tarefa.id,
          titulo: tarefa.titulo,
          status: tarefa.status,
          atribuidoPara: tarefa.atribuidoPara ?? null,
          formularios,
          progresso: { total: formularios.length, concluidos },
        };
      })
    );

    const eventos = await this.repo.findEventos(demandaId);
    const tarefasConcluidas = tarefas.filter(t => t.status === 'concluido').length;

    return {
      demanda,
      tarefas,
      eventos,
      progresso: { tarefasTotal: tarefas.length, tarefasConcluidas },
    };
  }
}
