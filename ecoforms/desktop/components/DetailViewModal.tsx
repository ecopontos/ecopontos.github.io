
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TblSuiteRecord, FormField, SuiteStatus } from "@/types"
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, Copy, Check, FileJson, LayoutTemplate, CloudUpload, Table as TableIcon, Search } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useFormTemplate } from "@/src/interface/hooks/catalog/forms"
import { useInboxMutations } from "@/src/interface/hooks/catalog/forms"
import { useAllUsers } from "@/src/interface/hooks/catalog/auth"

interface DetailViewModalProps {
    record: TblSuiteRecord | null
    open: boolean
    onOpenChange: (open: boolean) => void
    hideActions?: boolean
}


export function DetailViewModal({ record, open, onOpenChange, hideActions = false }: DetailViewModalProps) {
    const [copied, setCopied] = useState(false)
    const { template, loading } = useFormTemplate(record?.tipo_form)
    const { updateStatus, processing } = useInboxMutations();
    const { user: currentUser } = useAuth();
    const { users: allUsers } = useAllUsers();
    const [searchTerm, setSearchTerm] = useState("");

    if (!record) return null

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(record, null, 2))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleStatusChange = async (status: SuiteStatus) => {
        if (!record) return;
        const success = await updateStatus(record.id, status, { revisorId: currentUser?.id });
        if (success) {
            onOpenChange(false);
        }
    };


    // Helper to find value in data by field path/id
    const getValue = (path: string, data: Record<string, unknown>): unknown => {
        // Simple case: direct key access
        if (data[path] !== undefined) return data[path];
        
        // Nested case (e.g. "group.field")
        return path.split('.').reduce<unknown>((obj, key) => {
            const o = obj as Record<string, unknown> | null | undefined;
            return o ? o[key] : undefined;
        }, data);
    }

    const renderSmartField = (field: FormField) => {
        const value = getValue(field.id, record.dados) as string | { url?: string; dataUrl?: string } | null | undefined;
        if (value === undefined || value === null || value === '') return null;

        // Suporte para objetos de imagem (resultado do upload ou CameraFieldV2)
        const displayUrl = typeof value === 'string' ? value : value?.url || value?.dataUrl || null;

        // Detect if value is an image (URL or base64)
        const isImageUrl = (typeof displayUrl === 'string') && (
            displayUrl.startsWith('data:image/') ||
            displayUrl.includes('/storage/v1/object/public/') ||
            (displayUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) && displayUrl.startsWith('http'))
        );

        return (
            <div key={field.id} className="p-3 bg-white border rounded-md shadow-sm">
                <p className="text-xs font-semibold text-slate-500 mb-1">{field.label}</p>
                <div className="text-sm text-slate-900 overflow-wrap-break-word">
                    {isImageUrl ? (
                        <div className="mt-2 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                            <img 
                                src={displayUrl} 
                                alt={field.label} 
                                className="max-w-full h-auto max-h-64 object-contain mx-auto"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    const fallback = document.createElement('p');
                                    fallback.className = 'p-4 text-xs text-slate-400 text-center italic';
                                    fallback.innerText = 'Imagem indisponível ou erro no carregamento.';
                                    parent?.appendChild(fallback);
                                }}
                            />
                        </div>
                    ) : Array.isArray(value) ? (
                        <div className="flex flex-wrap gap-1">
                            {value.map((v, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] py-0">{String(v)}</Badge>
                            ))}
                        </div>
                    ) : typeof value === 'object' ? (
                        <pre className="text-[10px] bg-slate-50 p-1 rounded font-mono overflow-auto max-h-32">
                            {JSON.stringify(value, null, 2)}
                        </pre>
                    ) : (
                        String(value)
                    )}
                </div>
            </div>
        )
    }

    // Helper para exibir nome (username) do usuário
    const getUserDisplay = (userId: string | null | undefined) => {
        if (!userId) return 'Anônimo';
        const user = allUsers.find(u => u.id === userId);
        if (user) {
            return `${user.nome} (${user.username})`;
        }
        return userId; // fallback para o id se não encontrado
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
                <DialogHeader className="mb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        Detalhes do Registro
                        <span className="font-mono text-sm font-normal text-slate-400">
                            #{record.id.slice(0, 8)}
                        </span>
                    </DialogTitle>
                    <DialogDescription>
                        Recebido em {new Date(record.criado_em).toLocaleString('pt-BR')} via {record.tipo_form}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="smart" className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <TabsList>
                            <TabsTrigger value="smart" className="flex gap-2">
                                <LayoutTemplate className="h-4 w-4" />
                                Visão Detalhada
                            </TabsTrigger>
                            <TabsTrigger value="table" className="flex gap-2">
                                <TableIcon className="h-4 w-4" />
                                Tabela
                            </TabsTrigger>
                            <TabsTrigger value="json" className="flex gap-2">
                                <FileJson className="h-4 w-4" />
                                Dados JSON
                            </TabsTrigger>
                        </TabsList>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopy}
                            className="gap-2 text-xs"
                        >
                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copied ? "Copiado!" : "Copiar JSON"}
                        </Button>
                    </div>

                    <TabsContent value="smart" className="flex-1 overflow-hidden mt-0">
                        <ScrollArea className="h-full pr-4">
                            <div className="space-y-6">
                                {/* Metadata Section */}
                                <section>
                                    <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        Metadados do Sistema
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Usuário</p>
                                            <p className="font-mono text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1">{getUserDisplay(record.user_id)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Status</p>
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${record.ativo
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {record.ativo ? 'Ativo' : 'Arquivado'}
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                {/* Form Fields Section */}
                                <section>
                                    <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-blue-500 rounded-full" />
                                        Dados do Formulário
                                    </h3>
                                    
                                    {template ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-lg">
                                            {template.campos.map(renderSmartField)}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 bg-slate-50 rounded border border-dashed">
                                            <p className="text-sm text-slate-500">
                                                {loading ? "Carregando template..." : "Template de formulário não encontrado localmente."}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Exibindo modo JSON como fallback.
                                            </p>
                                        </div>
                                    )}
                                </section>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="table" className="flex-1 overflow-hidden mt-0">
                        <div className="flex flex-col h-full space-y-3">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Filtrar chaves ou valores..."
                                    className="pl-9 h-9 text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex-1 overflow-hidden border rounded-md">
                                <ScrollArea className="h-full">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-slate-50 z-10">
                                            <TableRow>
                                                <TableHead className="w-[30%]">Campo/Chave</TableHead>
                                                <TableHead>Valor</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {record.dados ? (
                                                Object.entries(record.dados)
                                                    .filter(([key, val]) => {
                                                        const search = searchTerm.toLowerCase();
                                                        return key.toLowerCase().includes(search) || 
                                                               String(val).toLowerCase().includes(search);
                                                    })
                                                    .map(([key, val]) => (
                                                        <TableRow key={key}>
                                                            <TableCell className="font-semibold text-slate-700 align-top">
                                                                {key}
                                                            </TableCell>
                                                            <TableCell className="text-slate-600 break-all">
                                                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                            ) : null}
                                            {record.dados && Object.keys(record.dados).length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={2} className="text-center py-10 text-slate-400">
                                                        Nenhum dado encontrado para este registro.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="json" className="flex-1 overflow-hidden mt-0">
                         <ScrollArea className="h-full">
                            <div className="rounded-md bg-slate-950 border border-slate-800 p-4">
                                <pre className="text-sm font-mono text-emerald-400 whitespace-pre-wrap break-all">
                                    {JSON.stringify(record.dados, null, 2)}
                                </pre>
                            </div>
                         </ScrollArea>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="border-t pt-4 mt-auto">
                    <div className="flex gap-2 w-full justify-between items-center">
                        <div className="text-xs text-muted-foreground">
                            {['pending', 'under_review', 'submitted'].includes(record.status as string) ? '🟡 Aguardando Revisão' : `Status: ${record.status ?? '—'}`}
                        </div>
                        {!hideActions && (
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={() => handleStatusChange('rejected')} 
                                    disabled={processing}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    Rejeitar
                                </Button>
                                <Button 
                                    onClick={() => handleStatusChange('approved')} 
                                    disabled={processing}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    {processing ? 'Salvando...' : 'Aprovar'}
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
