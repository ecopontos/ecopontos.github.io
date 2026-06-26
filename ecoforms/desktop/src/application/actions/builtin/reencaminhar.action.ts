import { registerAction } from "../ActionRegistry";
import type { ActionContext, ActionResult } from "../ActionRegistry";
import { uuidv7 } from 'ecoforms-core';

const SQL_PACOTE_INACTIVATE = `UPDATE pacotes SET atual = 0 WHERE id_pacote = ? AND atual = 1`;
const SQL_PACOTE_DISPATCHED = `INSERT INTO pacotes (id_pacote, num_versao, tipo_modulo, tipo_recurso, status, id_proprietario, atual, ref_id_pacote, id_entidade, tipo_entidade, carga_json, criado_em, fechado_em) SELECT ?, 1, tipo_modulo, tipo_recurso, 'dispatched', ?, 1, ?, id_entidade, tipo_entidade, carga_json, ?, NULL FROM pacotes WHERE id_pacote = ? AND atual = 0 ORDER BY num_versao DESC LIMIT 1`;
const SQL_TAREFA_SET_DEMANDA = `UPDATE tarefas SET demanda_id = ?, atualizado_em = datetime('now') WHERE id = ?`;
const SQL_LOG_ACAO = `INSERT INTO log_acoes (id, id_acao, tipo_alvo, id_alvo, id_usuario, resultado, criado_em) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
const SQL_LOG_ACAO_ERRO = `INSERT INTO log_acoes (id, id_acao, tipo_alvo, id_alvo, id_usuario, erro, criado_em) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;

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
          SQL_PACOTE_INACTIVATE,
          [origemId]
        );

        // 2. Criar nova suite com status dispatched + transfer
        const novoId = uuidv7();
        await ctx.container.sqlite.execute(
          SQL_PACOTE_DISPATCHED,
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
            SQL_TAREFA_SET_DEMANDA,
            [demanda.id, origemId]
          );
        }

        // 5. Registrar em log_acoes
        await ctx.container.sqlite.execute(
          SQL_LOG_ACAO,
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
            SQL_LOG_ACAO_ERRO,
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