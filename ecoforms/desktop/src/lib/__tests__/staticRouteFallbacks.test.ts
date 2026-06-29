import { describe, expect, it } from "vitest";
import { resolveStaticRouteFallback } from "../staticRouteFallbacks";

describe("resolveStaticRouteFallback", () => {
    it("redireciona rota de task preservando query string", () => {
        expect(resolveStaticRouteFallback("/tasks/abc-123", "?action=approve")).toBe("/tasks/detalhe?action=approve&id=abc-123");
    });

    it("redireciona rota de módulo para a entrada estática", () => {
        expect(resolveStaticRouteFallback("/modulo/coletas")).toBe("/modulo?slug=coletas");
    });

    it("redireciona rota admin aninhada mais específica antes da genérica", () => {
        expect(resolveStaticRouteFallback("/admin/agendamentos/slots/slot-9/editar")).toBe("/admin/agendamentos/slots/editar?id=slot-9");
    });

    it("retorna null quando a rota não é candidata a fallback", () => {
        expect(resolveStaticRouteFallback("/login")).toBeNull();
    });
});
