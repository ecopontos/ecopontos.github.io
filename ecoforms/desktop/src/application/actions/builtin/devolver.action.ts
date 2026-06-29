import { PACOTE_INACTIVATE_ATUAL, PACOTE_NEW_VERSION_FROM_LAST } from '../../persistence/sqlite/queries/pacotes';
import { registerAction } from "../ActionRegistry";


export function registerDevolverAction() {
  registerAction({
    id: "devolver",
    label: "Devolver",
    icon: "RotateCcw",
    color: "orange",
    enabledWhen: [
      { fieldId: "status", operator: "neq", value: "refuted" },
      { fieldId: "status", operator: "neq", value: "locked" },
    ],
    requiredRoles: ["admin", "gerente", "coordenador"],
    handler: async (ctx) => {
      try {
        const id = ctx.targetId;
        const now = new Date().toISOString();

        // Versionamento: invalidar versão atual e criar nova com status refuted
        await ctx.container.sqlite.execute(
          PACOTE_INACTIVATE_ATUAL.sql,
          [id]
        );

        await ctx.container.sqlite.execute(
          PACOTE_NEW_VERSION_FROM_LAST.sql,
          [id, now, id]
        );

        await ctx.syncOutbox.write("suite.devolvida", {
          packageId: id,
          devolvidoPor: ctx.userId,
        });

        await ctx.syncNow();
        return { success: true, message: "Registro devolvido com sucesso" };
      } catch (err) {
        return { success: false, message: `Erro ao devolver: ${String(err)}` };
      }
    },
  });
}
