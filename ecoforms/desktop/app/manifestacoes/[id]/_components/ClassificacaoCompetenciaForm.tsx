import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";

interface ClassificacaoCompetenciaFormProps {
  manifestacao: ManifestacaoSummary;
  classificacoes: { id: string; nome: string }[];
  subassuntos: { id: string; nome: string }[];
  subunidades: { id: string; nome: string }[];
  programas: { id: string; nome: string }[];
  classAssuntoId: string;
  classSubassuntoId: string;
  classSubunidadeId: string;
  classProgramaId: string;
  setClassAssuntoId: (v: string) => void;
  setClassSubassuntoId: (v: string) => void;
  setClassSubunidadeId: (v: string) => void;
  setClassProgramaId: (v: string) => void;
  onClassificar: () => void;
  saving: boolean;
}

export function ClassificacaoCompetenciaForm({
  manifestacao, classificacoes, subassuntos, subunidades, programas,
  classAssuntoId, classSubassuntoId, classSubunidadeId, classProgramaId,
  setClassAssuntoId, setClassSubassuntoId, setClassSubunidadeId, setClassProgramaId,
  onClassificar, saving,
}: ClassificacaoCompetenciaFormProps) {
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">Classificação Administrativa</CardTitle>
        <CardDescription>Preencha os dados de classificação e clique em &ldquo;Classificar e Encaminhar&rdquo; para mover a manifestação para atendimento.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Assunto</Label>
          <select
            value={classAssuntoId}
            onChange={e => { setClassAssuntoId(e.target.value); setClassSubassuntoId(""); }}
            className="w-full border rounded-md px-3 py-2 bg-background text-sm"
          >
            <option value="">Selecione o assunto...</option>
            {classificacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Subassunto</Label>
          <select
            value={classSubassuntoId}
            onChange={e => setClassSubassuntoId(e.target.value)}
            disabled={!classAssuntoId || subassuntos.length === 0}
            className="w-full border rounded-md px-3 py-2 bg-background text-sm disabled:opacity-50"
          >
            <option value="">
              {!classAssuntoId ? "Selecione um assunto primeiro" : subassuntos.length === 0 ? "Nenhum subassunto cadastrado" : "Selecione o subassunto..."}
            </option>
            {subassuntos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Subunidade <span className="text-muted-foreground text-xs">(setor: {manifestacao.setorNome || "—"})</span></Label>
          <select
            value={classSubunidadeId}
            onChange={e => setClassSubunidadeId(e.target.value)}
            disabled={subunidades.length === 0}
            className="w-full border rounded-md px-3 py-2 bg-background text-sm disabled:opacity-50"
          >
            <option value="">{subunidades.length === 0 ? "Nenhuma subunidade cadastrada" : "Selecione a subunidade..."}</option>
            {subunidades.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Programa Orçamentário</Label>
          <select
            value={classProgramaId}
            onChange={e => setClassProgramaId(e.target.value)}
            disabled={programas.length === 0}
            className="w-full border rounded-md px-3 py-2 bg-background text-sm disabled:opacity-50"
          >
            <option value="">{programas.length === 0 ? "Nenhum programa cadastrado" : "Selecione o programa..."}</option>
            {programas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={onClassificar} disabled={saving}>
            Classificar e Encaminhar para Atendimento
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
