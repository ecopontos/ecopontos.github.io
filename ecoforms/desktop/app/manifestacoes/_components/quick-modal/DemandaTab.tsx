import { Badge } from "@/components/ui/badge";
import type { ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { PrazoBadge, relativeTime } from "../../_lib/helpers";

interface DemandaTabProps {
  selected: ManifestacaoSummary;
}

/** Aba "Demanda": dados gerais, solicitante, descrição e encaminhamento (se houver). */
export function DemandaTab({ selected }: DemandaTabProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{selected.tipoNome}</span></div>
        <div><span className="text-muted-foreground">Origem:</span> <span className="font-medium">{selected.origemNome}</span></div>
        <div><span className="text-muted-foreground">Classificação:</span> <span className="font-medium">{selected.classificacaoNome}</span></div>
        <div><span className="text-muted-foreground">Prioridade:</span> <span className="font-medium">{selected.prioridade}</span></div>
        <div><span className="text-muted-foreground">Setor:</span> <span className="font-medium">{selected.setorNome || "—"}</span></div>
        <div><span className="text-muted-foreground">Responsável:</span> <span className="font-medium">{selected.responsavelNome || "—"}</span></div>
        <div><span className="text-muted-foreground">Registrado:</span> <span className="font-medium">{new Date(selected.criadoEm).toLocaleString("pt-BR")}</span></div>
        {selected.atualizadoEm && (
          <div><span className="text-muted-foreground">Atualizado:</span> <span className="font-medium">{relativeTime(selected.atualizadoEm)}</span></div>
        )}
        {selected.prazoLimite && (
          <div className="flex items-center gap-2 col-span-2">
            <span className="text-muted-foreground">Prazo:</span>
            <span className="font-medium">{new Date(selected.prazoLimite).toLocaleDateString("pt-BR")}</span>
            <PrazoBadge m={selected} />
          </div>
        )}
        {selected.competencia === 'compete' && (
          <div className="col-span-2"><Badge variant="outline" className="text-green-700 border-green-400">Competência confirmada</Badge></div>
        )}
      </div>

      {!selected.anonimo && (
        <div className="rounded-md border p-3 text-sm space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Solicitante</p>
          <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{selected.solicitanteNome || "—"}</span></div>
          {selected.solicitanteEmail && <div><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{selected.solicitanteEmail}</span></div>}
          {selected.solicitanteTelefone && <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{selected.solicitanteTelefone}</span></div>}
        </div>
      )}

      {selected.descricao && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Descrição da manifestação</p>
          <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/30 border p-3">{selected.descricao}</p>
        </div>
      )}

      {selected.orgaoDestino && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm">
          <p className="font-semibold text-orange-800">Encaminhado para outra Ouvidoria</p>
          <p className="text-orange-700">Destino: {selected.orgaoDestino}</p>
          {selected.motivoIncompetencia && <p className="text-orange-700 mt-1">Motivo: {selected.motivoIncompetencia}</p>}
        </div>
      )}
    </>
  );
}
