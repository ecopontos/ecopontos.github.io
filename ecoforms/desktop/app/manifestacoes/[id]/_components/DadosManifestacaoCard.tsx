import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";

interface DadosManifestacaoCardProps {
  manifestacao: ManifestacaoSummary;
}

const prioridadeBadge = (prioridade: string) => {
  const map: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    normal: "outline",
    urgente: "secondary",
    critico: "destructive",
  };
  return <Badge variant={map[prioridade] || "outline"}>{prioridade}</Badge>;
};

export function DadosManifestacaoCard({ manifestacao }: DadosManifestacaoCardProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Demanda do Cidadão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Assunto</p>
              <p className="font-medium">{manifestacao.assunto}</p>
            </div>
            {manifestacao.descricao && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Descrição</p>
                <p className="whitespace-pre-wrap text-sm rounded bg-muted/30 border p-2">{manifestacao.descricao}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {manifestacao.anonimo ? "Solicitante Anônimo" : "Solicitante"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {manifestacao.anonimo ? (
              <p className="text-muted-foreground italic">Identidade omitida</p>
            ) : (
              <>
                <p className="font-medium">{manifestacao.solicitanteNome || "—"}</p>
                {manifestacao.solicitanteEmail && <p className="text-muted-foreground">{manifestacao.solicitanteEmail}</p>}
                {manifestacao.solicitanteTelefone && <p className="text-muted-foreground">{manifestacao.solicitanteTelefone}</p>}
                {manifestacao.clienteNome && <p className="text-muted-foreground">Vínculo: {manifestacao.clienteNome}</p>}
              </>
            )}
            {manifestacao.sigiloso && <Badge variant="destructive" className="mt-1">Sigiloso</Badge>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Tipo</CardDescription></CardHeader>
          <CardContent><p className="font-medium">{manifestacao.tipoNome}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Origem</CardDescription></CardHeader>
          <CardContent><p className="font-medium">{manifestacao.origemNome}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Prioridade</CardDescription></CardHeader>
          <CardContent>{prioridadeBadge(manifestacao.prioridade)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Setor Responsável</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{manifestacao.setorNome || "—"}</p>
          </CardContent>
        </Card>
      </div>
      {(manifestacao.anonimo || manifestacao.sigiloso || manifestacao.manifestacaoOrigemId) && (
        <div className="flex gap-2">
          {manifestacao.anonimo ? <Badge variant="secondary">Anônimo</Badge> : null}
          {manifestacao.sigiloso ? <Badge variant="destructive">Sigiloso</Badge> : null}
          {manifestacao.manifestacaoOrigemId ? <Badge variant="outline">Reincidência</Badge> : null}
        </div>
      )}
    </>
  );
}
