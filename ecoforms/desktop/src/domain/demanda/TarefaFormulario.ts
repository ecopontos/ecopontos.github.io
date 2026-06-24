export interface TarefaFormulario {
  id: string;
  tarefaId: string;
  formRegistryId: string;
  formVersion: number;
  formSnapshot: Record<string, unknown>;
  ordem: number;
  obrigatorio: boolean;
  concluido: boolean;
  concluidoEm: string | null;
}
