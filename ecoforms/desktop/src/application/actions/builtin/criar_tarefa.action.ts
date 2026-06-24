import { registerAction } from "../ActionRegistry";

export function registerCriarTarefaAction() {
  registerAction({
    id: "criar_tarefa",
    label: "Criar Tarefa",
    icon: "ClipboardList",
    color: "purple",
    enabledWhen: [
      { fieldId: "status", operator: "neq", value: "locked" },
    ],
    requiredRoles: ["admin", "gerente", "coordenador", "encarregado"],
    handler: async (ctx) => {
      try {
        const suiteId = ctx.targetId;
        const titulo = (ctx.input?.titulo as string) || `Tarefa vinculada a ${suiteId}`;
        const responsavel = (ctx.input?.responsavel as string) || ctx.userId;
        const prazo = (ctx.input?.prazo as string) || undefined;

        const tarefaId = await ctx.container.taskProjection.project({
          titulo,
          atribuidoPara: responsavel,
          prazo,
          criadoPor: ctx.userId,
          origemTipo: 'suite',
          origemId: suiteId,
          setorId: null,
        });

        await ctx.syncNow();
        return { success: true, message: "Tarefa criada com sucesso", redirect: `/tasks/${tarefaId}` };
      } catch (err) {
        return { success: false, message: `Erro ao criar tarefa: ${String(err)}` };
      }
    },
  });
}
