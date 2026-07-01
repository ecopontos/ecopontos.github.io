import { PACOTE_INACTIVATE_ATUAL, PACOTE_NEW_VERSION_DISPATCHED } from '../../../infrastructure/persistence/sqlite/queries/pacotes';
import { TAREFA_SET_DEMANDA } from '../../../infrastructure/persistence/sqlite/queries/tarefas';
import { LOG_ACAO_INSERT, LOG_ACAO_INSERT_ERRO } from '../../../infrastructure/persistence/sqlite/queries/log_acoes';
import { registerAction } from "../ActionRegistry";
import type { ActionContext, ActionResult } from "../ActionRegistry";
import { uuidv7 } from 'ecoforms-core';


/**
 * Acao: Reencaminhar — transferencia total de propriedade.
 *
 * Diferentemente de ENCAMINHAR (que compartilha com novo setor mantendo a origem),
 * REENCAMINHAR transfere a propriedade total para o novo setor. O registro original
 * e marcado como dispatched/transfer e perde posse.
 *
 * Pre-condicoes:
 * - Usuario deve ter perfil admin, gerente ou coordenador
 * - A tarefa/demanda nao pode estar concluida ou cancelada
 *
 * Comportamento:
 * 1. Marca o registro atual como transferred (is_current=0)
 * 2. Cria nova Demanda com destinatarioId = setor selecionado
 * 3. Registra em log_acoes
 * 4. Publica evento "suite.reencaminhada"
 */
export function registerReencaminharAction() {
  registerAction({
    id: "reencaminhar",
    label: "Reencaminhar",
    icon: "ArrowRightLeft",
    color: "destructive",
    confirmationRequired: false,
    enabledWhen: [
      { fieldId: "status", operator: "neq", value: "concluido" },
      { fieldId: "status", operator: "neq", value: "cancelado" },
      { fieldId: "status", operator: "neq", value: "closed" },
    ],
    requiredRoles: ["admin", "gerente", "coordenador"],
    expandPanel: {
      panel: "reencaminhar",
    },
    fieldMapping: {
      origemId: { from: "targetId" },
    },
    handler: async (ctx: ActionContext): Promise<ActionResult> => {
      const destinatarioId = ctx.input?.setorDestino as string;
      const motivo = ctx.input?.motivo as string;
      const origemId = ctx.targetId;
      const now = new Date().toISOString();
      const demandas = ctx.container.demandas as {
        create: {
          execute(input: Record<string, unknown>): Promise<{ id: string }>;
        };
      };

      if (!destinatarioId || !motivo) {
        return { success: false, message: "Preencha todos os campos obrigatorios." };
      }

      try {
        // 1. Marcar registro original como transferido (perde posse total)
        await ctx.container.sqlite.execute(
          PACOTE_INACTIVATE_ATUAL.sql,
          [origemId]
        );

        // 2. Criar nova suite com status dispatched + transfer
        const novoId = uuidv7();
        await ctx.container.sqlite.execute(
          PACOTE_NEW_VERSION_DISPATCHED.sql,
          [novoId, destinatarioId, origemId, now, origemId]
        );

        // 3. Criar Demanda de reencaminhamento
        const demanda = await demandas.create.execute({
          origemTipo: "reencaminhamento",
          origemId,
          solicitanteId: ctx.userId,
          destinatarioId,
          tipoAcao: "transferencia",
          descricao: motivo,
          politicaConclusao: "todas",
        });

        // 4. Vincula a demanda à tarefa de origem
        if (ctx.targetType === 'task') {
          await ctx.container.sqlite.execute(
            TAREFA_SET_DEMANDA.sql,
            [demanda.id, origemId]
          );
        }

        // 5. Registrar em log_acoes
        await ctx.container.sqlite.execute(
          LOG_ACAO_INSERT.sql,
          [
            uuidv7(),
            "reencaminhar",
            ctx.targetType,
            ctx.targetId,
            ctx.userId,
            JSON.stringify({ demandaId: demanda.id, destinatarioId, motivo }),
          ]
        );

        // 6. Publicar evento
        await ctx.syncOutbox.write("suite.reencaminhada", {
          packageId: origemId,
          destinatarioId,
          reencaminhadoPor: ctx.userId,
          demandaId: demanda.id,
        });

        await ctx.syncNow();

        return {
          success: true,
          message: `Propriedade transferida para ${destinatarioId}. Demanda #${demanda.id.slice(0, 8)} criada.`,
        };
      } catch (err) {
        try {
          await ctx.container.sqlite.execute(
            LOG_ACAO_INSERT_ERRO.sql,
            [
              uuidv7(),
              "reencaminhar",
              ctx.targetType,
              ctx.targetId,
              ctx.userId,
              String(err),
            ]
          );
        } catch {
          // ignore logging errors
        }
        return { success: false, message: `Falha ao reencaminhar: ${String(err)}` };
      }
    },
  });
}
