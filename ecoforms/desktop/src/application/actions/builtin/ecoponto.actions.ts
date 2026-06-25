import { registerAction } from "../ActionRegistry";
import type { ActionContext, ActionResult } from "../ActionRegistry";

/**
 * Ação: Encaminhar remoção de ecoponto para o setor de coleta.
 *
 * Pré-condições:
 * - A tarefa atual deve estar vinculada a um ecoponto (via formData.ecopontoId ou payload)
 * - Usuário deve ter perfil admin, gerente ou coordenador
 *
 * Comportamento:
 * 1. Cria uma tarefa local "Remoção Ecoponto {id}" no status 'a_fazer'
 * 2. Publica evento `ecoponto.remocao.agendada` para sync
 */
export function registerEcopontoActions() {
  registerAction({
    id: "ecoponto_encaminhar_remocao",
    label: "Encaminhar Remoção",
    icon: "Truck",
    color: "emerald",
    confirmationRequired: true,
    confirmationMessage:
      "Confirma o encaminhamento da remoção deste ecoponto para o setor de coleta?",
    requiredRoles: ["admin", "gerente", "coordenador"],
    enabledWhen: [
      { fieldId: "ecopontoId", operator: "notEmpty" },
      { fieldId: "status", operator: "neq", value: "concluido" },
    ],
    requiresInput: {
      fields: [
        {
          id: "setorRemocao",
          label: "Setor responsável pela remoção",
          type: "select",
          required: true,
          options: [
            { value: "setor-coleta", label: "Coleta de Resíduos" },
            { value: "setor-ambiente", label: "Meio Ambiente" },
            { value: "setor-fiscalizacao", label: "Fiscalização Ambiental" },
          ],
        },
        {
          id: "observacao",
          label: "Observação (opcional)",
          type: "text",
          required: false,
        },
      ],
    },
    fieldMapping: {
      ecopontoId: { from: "formData.ecopontoId" },
      setorRemocao: { from: "input.setorRemocao" },
      observacao: { from: "input.observacao" },
    },
    handler: async (ctx: ActionContext): Promise<ActionResult> => {
      const ecopontoId = ctx.formData?.ecopontoId as string;
      const setorRemocao = ctx.input?.setorRemocao as string;
      const observacao = (ctx.input?.observacao as string) || "";

      if (!ecopontoId || !setorRemocao) {
        return { success: false, message: "Dados incompletos para encaminhamento." };
      }

      try {
        const taskId = await ctx.commands.invoke<string>("ecoponto_agendar_remocao", {
          ecopontoId,
          setorDestino: setorRemocao,
          observacao: observacao || null,
        });

        await ctx.syncOutbox.write("ecoponto.remocao.agendada", {
          ecopontoId,
          taskId,
          setorRemocao,
          agendadoPor: ctx.userId,
          observacao,
        });

        return {
          success: true,
          message: `Remoção do ecoponto ${ecopontoId} encaminhada para ${setorRemocao}.`,
        };
      } catch (err) {
        return { success: false, message: `Falha ao encaminhar remoção: ${String(err)}` };
      }
    },
  });
}
