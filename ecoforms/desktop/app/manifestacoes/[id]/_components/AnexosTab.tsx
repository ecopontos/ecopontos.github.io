import { Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Anexo } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { toast } from "sonner";

interface AnexosTabProps {
  anexos: Anexo[];
  manifestacaoId: string | null;
  uploadAnexo: (id: string) => Promise<unknown>;
  uploadingAnexo: boolean;
  handleRemoveAnexo: (anexoId: string) => void;
  refetchAnexos: () => void;
  saving: boolean;
}

export function AnexosTab({
  anexos, manifestacaoId, uploadAnexo, uploadingAnexo, handleRemoveAnexo, refetchAnexos, saving,
}: AnexosTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Anexos</CardTitle>
          <Button size="sm" onClick={async () => {
            try {
              const result = await uploadAnexo(manifestacaoId!);
              if (result) { toast.success("Anexo adicionado"); refetchAnexos(); }
            } catch { toast.error("Erro ao adicionar anexo"); }
          }} disabled={uploadingAnexo || saving}>
            <Paperclip className="h-4 w-4 mr-1" /> Anexar arquivo
          </Button>
        </CardHeader>
        <CardContent>
          {anexos.length === 0 ? (
            <p className="text-muted-foreground">Nenhum anexo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {anexos.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>{a.nomeArquivo}</TableCell>
                    <TableCell>{a.mimeType || "—"}</TableCell>
                    <TableCell>{new Date(a.criadoEm).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveAnexo(a.id)} disabled={saving}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
