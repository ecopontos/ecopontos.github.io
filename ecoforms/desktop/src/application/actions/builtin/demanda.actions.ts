import { registerAction } from "../ActionRegistry";
import type { ActionDemandaClose } from "../ActionRegistry";
import { uuidv7 } from 'ecoforms-core';

const SQL_LOG_ACAO = `INSERT INTO log_acoes (id, id_acao, tipo_alvo, id_alvo, id_usuario, resultado, criado_em) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;

export function registerDemandaActions() {
  registerAction({
    id: "demanda_aceitar",
    label: "Aceitar Demanda",
    icon: "CheckCircle",
    color: "green",
    enabledWhen: [{ fieldId: "status", operator: "eq", value: "aberta" }],
    requiredRoles: ["admin", "gerente", "coordenador"],
    handler: async (ctx) => {
      try {
        const demanda = ctx.demand as { id: string } | undefined;
        if (!demanda) throw new Error("Demanda não disponível no contexto");

        // Aceite rápido via Rust: valida RBAC + audit + status flip simples.
        // Para aceite completo com criação de tarefas, usar AcceptDemandaUseCase via useDemandas.
        await ctx.commands.invoke("demanda_aceitar", { id: demanda.id });

        await ctx.syncOutbox.write('demanda.aceita', {
          demandaId: demanda.id,
          aceitoPor: ctx.userId,
          tarefasCriadas: 0, // aceite rápido não cria tarefas
        }, { aggregateId: demanda.id });

        await ctx.syncNow();
        return { success: true, message: "Demanda aceita com sucesso", redirect: `/demandas/${demanda.id}` };
      } catch (err) {
        return { success: false, message: `Erro ao aceitar demanda: ${String(err)}` };
      }
    },
  });

  registerAction({
    id: "demanda_encerrar",
    label: "Encerrar Demanda",
    icon: "XCircle",
    color: "red",
    enabledWhen: [{ fieldId: "status", operator: "eq", value: "aceita" }],
    requiredRoles: ["admin", "gerente", "coordenador"],
    handler: async (ctx) => {
      try {
        const demanda = ctx.demand as { id: string } | undefined;
        if (!demanda) throw new Error("Demanda não disponível no contexto");

        // CloseDemandaUseCase: valida politicaConclusao, salva demandas_eventos e escreve no SyncOutbox.
        const { close } = ctx.container.demandas as { close: ActionDemandaClose };
        await close.execute({
          demandaId: demanda.id,
          encerradoPor: ctx.userId,
        });

        // Registra em log_acoes (rastro operacional — log_auditoria via Rust não é chamado neste fluxo)
        await ctx.container.sqlite.execute(
          SQL_LOG_ACAO,
          [uuidv7(), "demanda_encerrar", ctx.targetType, demanda.id, ctx.userId, '{"status":"encerrada"}'],
        );

        await ctx.syncNow();
        return { success: true, message: "Demanda encerrada com sucesso" };
      } catch (err) {
        // CloseDemandaUseCase lança erro descritivo se politicaConclusao bloquear
        return { success: false, message: String(err) };
      }
    },
  });
}
