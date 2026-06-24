import { registerAction } from "../ActionRegistry";

export function registerSuiteActions() {
  registerAction({
    id: "suite_aprovar",
    label: "Aprovar",
    icon: "CheckCircle",
    color: "green",
    enabledWhen: [{ fieldId: "status", operator: "eq", value: "pending_review" }],
    requiredRoles: ["admin", "gerente", "coordenador"],
    handler: async (ctx) => {
      try {
        const suite = ctx.suitePackage as { id: string } | undefined;
        if (!suite) throw new Error("Suite não disponível no contexto");

        // ReviewSuiteUseCase: valida transição de estado no domínio (pending_review → current)
        // e persiste via repositório.
        await ctx.container.suites.review.execute({
          packageId: suite.id,
          approve: true,
          reviewerId: ctx.userId,
        });

        await ctx.syncNow();
        return { success: true, message: "Suite aprovada com sucesso" };
      } catch (err) {
        return { success: false, message: `Erro ao aprovar suite: ${String(err)}` };
      }
    },
  });

  registerAction({
    id: "suite_rejeitar",
    label: "Rejeitar",
    icon: "XCircle",
    color: "red",
    enabledWhen: [{ fieldId: "status", operator: "eq", value: "pending_review" }],
    requiredRoles: ["admin", "gerente", "coordenador"],
    handler: async (ctx) => {
      try {
        const suite = ctx.suitePackage as { id: string } | undefined;
        if (!suite) throw new Error("Suite não disponível no contexto");

        // ReviewSuiteUseCase: valida transição (pending_review → refuted), persiste via repositório.
        // SuiteRejeitado não é publicado pelo use case — publicamos aqui.
        await ctx.container.suites.review.execute({
          packageId: suite.id,
          approve: false,
          reviewerId: ctx.userId,
          motivo: ctx.input?.motivo as string | undefined,
        });

        await ctx.syncOutbox.write('suite.rejeitada', {
          suiteId: suite.id,
          rejeitadoPor: ctx.userId,
          motivo: ctx.input?.motivo ?? null,
        });

        await ctx.syncNow();
        return { success: true, message: "Suite rejeitada" };
      } catch (err) {
        return { success: false, message: `Erro ao rejeitar suite: ${String(err)}` };
      }
    },
  });
}
