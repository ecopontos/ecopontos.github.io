import { registerAction } from "../ActionRegistry";

const SQL_PACOTE_INACTIVATE = `UPDATE pacotes SET atual = 0 WHERE id_pacote = ? AND atual = 1`;
const SQL_PACOTE_NEW_VERSION_REFUTED = `INSERT INTO pacotes (id_pacote, num_versao, tipo_modulo, tipo_recurso, status, id_proprietario, atual, id_entidade, tipo_entidade, carga_json, criado_em, fechado_em) SELECT id_pacote, (SELECT COALESCE(MAX(num_versao), 0) + 1 FROM pacotes WHERE id_pacote = ?), tipo_modulo, tipo_recurso, 'refuted', id_proprietario, 1, id_entidade, tipo_entidade, carga_json, ?, NULL FROM pacotes WHERE id_pacote = ? AND atual = 0 ORDER BY num_versao DESC LIMIT 1`;

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
          SQL_PACOTE_INACTIVATE,
          [id]
        );

        await ctx.container.sqlite.execute(
          SQL_PACOTE_NEW_VERSION_REFUTED,
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
