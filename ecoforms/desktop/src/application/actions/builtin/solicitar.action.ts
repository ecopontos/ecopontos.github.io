import { PACOTE_BY_ID_ATUAL, PACOTE_SOLICITAR_INSERT } from '../../../infrastructure/persistence/sqlite/queries/pacotes';
import { registerAction } from "../ActionRegistry";
import { uuidv7 } from 'ecoforms-core';


export function registerSolicitarAction() {
  registerAction({
    id: "solicitar",
    label: "Solicitar",
    icon: "FilePlus",
    color: "blue",
    enabledWhen: [
      { fieldId: "status", operator: "neq", value: "locked" },
      { fieldId: "status", operator: "neq", value: "closed" },
    ],
    requiredRoles: ["admin", "gerente", "coordenador", "operador"],
    handler: async (ctx) => {
      try {
        const origemId = ctx.targetId;
        const now = new Date().toISOString();
        const novoId = uuidv7();

        // Obter dados do registro de origem
        const rows = await ctx.container.sqlite.query<{
          tipo_modulo: string;
          tipo_recurso: string;
          id_proprietario: string;
          id_entidade: string;
          tipo_entidade: string;
          carga_json: string;
        }>(PACOTE_BY_ID_ATUAL.sql, [origemId]);

        if (!rows || rows.length === 0) {
          throw new Error("Registro de origem não encontrado");
        }

        const origem = rows[0];

        await ctx.container.sqlite.execute(
          PACOTE_SOLICITAR_INSERT.sql,
          [
            novoId,
            origem.tipo_modulo,
            origem.tipo_recurso,
            ctx.userId,
            origemId,
            origem.id_entidade,
            origem.tipo_entidade,
            origem.carga_json,
            now,
          ]
        );

        await ctx.syncOutbox.write("suite.solicitada", {
          origemId,
          novoId,
          solicitadoPor: ctx.userId,
        });

        await ctx.syncNow();
        return { success: true, message: "Solicitação criada com sucesso", redirect: `/suite/${novoId}` };
      } catch (err) {
        return { success: false, message: `Erro ao solicitar: ${String(err)}` };
      }
    },
  });
}
