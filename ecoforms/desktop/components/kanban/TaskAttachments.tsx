'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react';
import { fetchTarefaAnexos, insertTarefaAnexo, deleteTarefaAnexo } from '@/src/interface/hooks/queries/lookups';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, FileText, Image, FileArchive, File, Download, Loader2 } from 'lucide-react';
import { useFileStorage } from '@/src/interface/hooks/catalog/utils';

interface TaskAttachment {
    id: string;
    tarefa_id: string;
    usuario_id: string;
    nome_arquivo: string;
    url_storage: string;
    tipo_mime: string | null;
    tamanho_bytes: number | null;
    created_at: string;
}

interface TaskAttachmentsProps {
    taskId: string;
    userId: string;
    readOnly?: boolean;
    onAttachmentChange?: () => void;
}



export function TaskAttachments({ taskId, userId, readOnly = false, onAttachmentChange }: TaskAttachmentsProps) {
    const fileStorage = useFileStorage();
    const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);



    // Load attachments from local SQLite
    const loadAttachments = async () => {
        if (!taskId) return;

        try {
            const result = await fetchTarefaAnexos(taskId);
            setAttachments((result as unknown as TaskAttachment[]) || []);
        } catch (err) {
            console.error('Error loading attachments:', err);
            setError('Erro ao carregar anexos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAttachments();
    }, [taskId]);

    // Generate unique ID
    const generateId = () => {
        return `anexo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    };

    // Get file icon based on MIME type
    const getFileIcon = (mimeType: string | null) => {
        if (!mimeType) return <File className="h-4 w-4" />;
        if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
        if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText className="h-4 w-4 text-red-500" />;
        if (mimeType.includes('zip') || mimeType.includes('archive')) return <FileArchive className="h-4 w-4 text-yellow-500" />;
        return <File className="h-4 w-4 text-gray-500" />;
    };

    // Format file size
    const formatSize = (bytes: number | null) => {
        if (!bytes) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Handle file selection
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        setError(null);

        try {
            for (const file of Array.from(files)) {
                await uploadFile(file);
            }
            await loadAttachments();
            onAttachmentChange?.();
        } catch (err) {
            console.error('Upload error:', err);
            setError('Erro ao enviar arquivo');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Upload single file
    const uploadFile = async (file: File) => {
        const attachmentId = generateId();
        const storagePath = `attachments/${taskId}/${attachmentId}_${file.name}`;

        // Upload via FileStoragePort
        const arrayBuffer = await file.arrayBuffer();
        const stored = await fileStorage.upload(
            'sync-bucket',
            storagePath,
            new Uint8Array(arrayBuffer),
            file.type || undefined,
        );

        const publicUrl = stored.publicUrl || fileStorage.getPublicUrl('sync-bucket', storagePath);

        await insertTarefaAnexo({
            id: attachmentId,
            tarefa_id: taskId,
            usuario_id: userId,
            nome_arquivo: file.name,
            url_storage: publicUrl,
            tipo_mime: file.type || '',
            tamanho_bytes: file.size,
        });

        console.log(`✅ Anexo salvo: ${file.name}`);
    };

    // Delete attachment
    const deleteAttachment = async (attachment: TaskAttachment) => {
        if (!confirm(`Remover anexo "${attachment.nome_arquivo}"?`)) return;

        try {
            // Try to delete from Storage (extract path from URL)
            const storagePath = attachment.url_storage.includes('sync-bucket/')
                ? attachment.url_storage.split('sync-bucket/')[1]
                : `attachments/${attachment.tarefa_id}/${attachment.id}_${attachment.nome_arquivo}`;

            await fileStorage.remove('sync-bucket', [storagePath]);

            await deleteTarefaAnexo(attachment.id);

            await loadAttachments();
            onAttachmentChange?.();
            console.log(`🗑️ Anexo removido: ${attachment.nome_arquivo}`);
        } catch (err) {
            console.error('Delete error:', err);
            setError('Erro ao remover anexo');
        }
    };

    // Download attachment
    const downloadAttachment = (attachment: TaskAttachment) => {
        window.open(attachment.url_storage, '_blank');
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando anexos...
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                    📎 Anexos
                    {attachments.length > 0 && (
                        <Badge variant="secondary" className="ml-2">{attachments.length}</Badge>
                    )}
                </label>
                {!readOnly && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploading ? 'Enviando...' : 'Adicionar'}
                    </Button>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="*/*"
            />

            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}

            {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                    Nenhum anexo adicionado
                </p>
            ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {attachments.map((att) => (
                        <div
                            key={att.id}
                            className="flex items-center gap-3 p-2 border rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                            {getFileIcon(att.tipo_mime)}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{att.nome_arquivo}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatSize(att.tamanho_bytes)}
                                    {att.created_at && ` • ${new Date(att.created_at).toLocaleDateString('pt-BR')}`}
                                </p>
                            </div>
                            <div className="flex gap-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => downloadAttachment(att)}
                                    title="Baixar"
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                                {!readOnly && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => deleteAttachment(att)}
                                        title="Remover"
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
