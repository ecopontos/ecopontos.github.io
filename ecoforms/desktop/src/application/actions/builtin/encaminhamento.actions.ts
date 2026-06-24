import { registerAction } from "../ActionRegistry";
import type { ActionContext, ActionResult } from "../ActionRegistry";
import { uuidv7 } from 'ecoforms-core';
import { LOG_ACAO_INSERT, LOG_ACAO_INSERT_ERRO } from "../../../infrastructure/persistence/sqlite/queries/log_acoes";
import { TAREFA_SET_DEMANDA } from "../../../infrastructure/persistence/sqlite/queries/tarefas";

/**
 * Ação: Encaminhar para outro setor via criação de Demanda.
 *
 * Pré-condições:
 * - Usuário deve ter perfil admin, gerente, coordenador ou operador
 * - A tarefa/demanda atual não pode já estar concluída
 *
 * Comportamento:
 * 1. Cria uma Demanda com destinatarioId = setor selecionado
 * 2. O CreateDemandaUseCase já publica `demanda.criada` automaticamente
 * 3. Registra em log_acoes
 */
export function registerEncaminhamentoActions() {
  registerAction({
    id: "encaminhar_para_setor",
    label: "Encaminhar para Setor",
    icon: "Forward",
    color: "blue",
    confirmationRequired: false,
    requiredRoles: ["admin", "gerente", "coordenador", "operador"],
    enabledWhen: [
      { fieldId: "status", operator: "neq", value: "concluido" },
      { fieldId: "status", operator: "neq", value: "cancelado" },
    ],
    expandPanel: {
      panel: "encaminhar",
    },
    fieldMapping: {
      origemId: { from: "targetId" },
    },
    handler: async (ctx: ActionContext): Promise<ActionResult> => {
      const destinatarioId = ctx.input?.setorDestino as string;
      const tipoAcao = ctx.input?.tipoAcao as string;
      const descricao = ctx.input?.descricao as string;
      const origemId = ctx.targetId;
      const demandas = ctx.container.demandas as {
        create: {
          execute(input: Record<string, unknown>): Promise<{ id: string }>;
        };
      };

      if (!destinatarioId || !tipoAcao || !descricao) {
        return { success: false, message: "Preencha todos os campos obrigatórios." };
      }

      try {
        // 1. Cria demanda — o use case já publica demanda.criada
        const demanda = await demandas.create.execute({
          origemTipo: "interno",
          origemId,
          solicitanteId: ctx.userId,
          destinatarioId,
          tipoAcao,
          descricao,
          politicaConclusao: "todas",
        });

        // 2. Vincula a demanda à tarefa de origem
        await ctx.container.sqlite.execute(
          TAREFA_SET_DEMANDA.sql,
          [demanda.id, origemId]
        );

        // 3. Registra em log_acoes
        await ctx.container.sqlite.execute(
          LOG_ACAO_INSERT.sql,
          [
            uuidv7(),
            "encaminhar_para_setor",
            ctx.targetType,
            ctx.targetId,
            ctx.userId,
            JSON.stringify({ demandaId: demanda.id, destinatarioId, tipoAcao }),
          ]
        );

        return {
          success: true,
          message: `Demanda #${demanda.id.slice(0, 8)} criada e encaminhada para ${destinatarioId}.`,
        };
      } catch (err) {
        // Log de erro
        try {
          await ctx.container.sqlite.execute(
            LOG_ACAO_INSERT_ERRO.sql,
            [
              uuidv7(),
              "encaminhar_para_setor",
              ctx.targetType,
              ctx.targetId,
              ctx.userId,
              String(err instanceof Error ? err.message : String(err)),
            ]
          );
        } catch (logErr) {
          console.error("[encaminhamento] falha ao registrar log de erro:", logErr);
        }
        return { success: false, message: `Falha ao encaminhar: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  });
}
