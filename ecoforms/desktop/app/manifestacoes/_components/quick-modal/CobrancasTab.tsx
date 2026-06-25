interface Cobranca {
  id: string;
  mensagem: string;
  criado_em: string;
  usuario_nome: string;
}

interface CobrancasTabProps {
  cobranças: Cobranca[];
}

/** Aba "Cobranças": notificações automáticas geradas por prazo vencido sem resposta. */
export function CobrancasTab({ cobranças }: CobrancasTabProps) {
  if (cobranças.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma cobrança registrada.</p>;
  }
  return (
    <>
      <p className="text-xs text-muted-foreground">Notificações automáticas geradas por prazo vencido sem resposta.</p>
      <div className="space-y-2">
        {cobranças.map(c => (
          <div key={c.id} className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-sm flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm text-foreground/80">{c.mensagem}</p>
              <p className="text-xs text-muted-foreground">Notificado: {c.usuario_nome || "—"}</p>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">{new Date(c.criado_em).toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>
    </>
  );
}
