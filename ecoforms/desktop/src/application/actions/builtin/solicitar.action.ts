import { registerAction } from "../ActionRegistry";
import { uuidv7 } from 'ecoforms-core';

const SQL_PACOTE_BY_ID = `SELECT tipo_modulo, tipo_recurso, id_proprietario, id_entidade, tipo_entidade, carga_json FROM pacotes WHERE id_pacote = ? AND atual = 1 LIMIT 1`;
const SQL_PACOTE_SOLICITAR = `INSERT INTO pacotes (id_pacote, num_versao, tipo_modulo, tipo_recurso, status, id_proprietario, atual, ref_id_pacote, id_entidade, tipo_entidade, carga_json, criado_em, fechado_em) VALUES (?, 1, ?, ?, 'current', ?, 1, ?, ?, ?, ?, ?, NULL)`;

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
        }>(SQL_PACOTE_BY_ID, [origemId]);

        if (!rows || rows.length === 0) {
          throw new Error("Registro de origem não encontrado");
        }

        const origem = rows[0];

        await ctx.container.sqlite.execute(
          SQL_PACOTE_SOLICITAR,
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
