import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RespostaFormatadaEditorProps {
  modelos: { id: string; titulo: string; corpo: string }[];
  editorModeloId: string;
  setEditorModeloId: (v: string) => void;
  editorTexto: string;
  setEditorTexto: (v: string) => void;
  onSaveRascunho: () => void;
  onSaveRespondida: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function RespostaFormatadaEditor({
  modelos,
  editorModeloId, setEditorModeloId,
  editorTexto, setEditorTexto,
  onSaveRascunho, onSaveRespondida, onCancel,
  saving,
}: RespostaFormatadaEditorProps) {
  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>Editor de Resposta ao Cidadão</CardTitle>
        <CardDescription>Selecione um modelo ou edite livremente. Clique em &ldquo;Marcar como Respondida&rdquo; para encerrar o atendimento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {modelos.length > 0 && (
          <div className="space-y-2">
            <Label>Modelo de resposta</Label>
            <select
              value={editorModeloId}
              onChange={e => {
                const modelo = modelos.find(m => m.id === e.target.value);
                setEditorModeloId(e.target.value);
                if (modelo) setEditorTexto(modelo.corpo);
              }}
              className="w-full border rounded-md px-3 py-2 bg-background text-sm"
            >
              <option value="">Sem modelo — editar livremente</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Resposta ao cidadão</Label>
          <Textarea
            value={editorTexto}
            onChange={e => setEditorTexto(e.target.value)}
            rows={8}
            placeholder="Escreva a resposta formal ao cidadão..."
          />
        </div>
        {editorTexto && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            <p className="text-xs text-muted-foreground mb-1">Pré-visualização</p>
            {editorTexto}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button variant="outline" onClick={onSaveRascunho} disabled={saving}>
            Salvar Rascunho
          </Button>
          <Button onClick={onSaveRespondida} disabled={saving}>
            Marcar como Respondida
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
