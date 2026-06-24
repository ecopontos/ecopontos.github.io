
"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/src/interface/hooks/catalog/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ImageDialog } from "./ImageDialog";
import { Loader2, Folder, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StorageFile {
    name: string;
    id: string | null;
    updated_at: string;
    created_at: string;
    last_accessed_at: string;
    metadata: Record<string, any> | null;
}

interface GalleryItem {
    name: string;
    url: string;
    isFolder: boolean;
    path: string;
    metadata?: any;
    previewUrl?: string | null;
    previewName?: string | null;
    recordDate?: string | Date | null;
    formTitle?: string | null;
}

export function GalleryGrid() {
    const [path, setPath] = useState<string>("");
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
    const supabase = useSupabaseClient();

    const fetchItems = async (currentPath: string) => {
        setLoading(true);
        try {
            const allProcessedItems: GalleryItem[] = [];

            // Helper to process items from a specific bucket and path
            const processBucketItems = async (bucket: string, internalPath: string, displayPathPrefix: string = "") => {
                const { data, error } = await supabase.storage
                    .from(bucket)
                    .list(internalPath, {
                        limit: 100,
                        offset: 0,
                        sortBy: { column: "created_at", order: "desc" },
                    });

                if (error) {
                    console.warn(`Erro ao listar ${bucket}/${internalPath}:`, error);
                    return [];
                }

                return await Promise.all(
                    (data || []).map(async (item: StorageFile) => {
                        const actuallyFolder = item.id === null;
                        const fullInternalPath = internalPath ? `${internalPath}/${item.name}` : item.name;
                        
                        // O displayPath é o que o usuário vê (ex: os IDs de usuário na raiz)
                        // Para o sync-bucket/users/, o item.name já é o ID do usuário.
                        
                        const { data: publicData } = supabase.storage
                            .from(bucket)
                            .getPublicUrl(fullInternalPath);

                        let previewUrl: string | null = null;
                        let previewName: string | null = null;

                        if (actuallyFolder) {
                            try {
                                // Tentar pegar um preview do folder
                                // No sync-bucket, se for um folder de usuário, as imagens estão em /images/
                                const previewListPath = (bucket === 'sync-bucket' && !internalPath.includes('/images')) 
                                    ? `${fullInternalPath}/images` 
                                    : fullInternalPath;

                                const { data: folderContent, error: folderError } = await supabase.storage
                                    .from(bucket)
                                    .list(previewListPath, {
                                        limit: 5,
                                        offset: 0,
                                        sortBy: { column: "created_at", order: "desc" },
                                    });

                                if (!folderError && folderContent?.length) {
                                    const fileEntries = folderContent.filter((entry) => entry.id !== null);
                                    if (fileEntries.length) {
                                        const firstFile = fileEntries[0];
                                        const { data: previewPublic } = supabase.storage
                                            .from(bucket)
                                            .getPublicUrl(`${previewListPath}/${firstFile.name}`);
                                        previewUrl = previewPublic.publicUrl;
                                        previewName = firstFile.name;
                                    }
                                }
                            } catch (previewError) {
                                // console.warn("Preview indisponível", fullInternalPath);
                            }
                        }

                        return {
                            name: item.name,
                            url: publicData.publicUrl,
                            isFolder: actuallyFolder,
                            path: fullInternalPath, // Caminho interno no bucket
                            bucket: bucket,         // Guardar bucket para delete/actions
                            metadata: item.metadata,
                            previewUrl,
                            previewName,
                        } as GalleryItem & { bucket: string };
                    })
                );
            };

            if (!currentPath) {
                // RAIZ: Listar IDs de usuários de ambos os buckets
                // 1. Legado: form-images/*
                const legacyUsers = await processBucketItems('form-images', '');
                // 2. Novo: sync-bucket/users/*
                const newUsers = await processBucketItems('sync-bucket', 'users');

                // Mesclar pastas de usuários únicos
                const userMap = new Map<string, any>();
                
                [...legacyUsers, ...newUsers].forEach(item => {
                    if (!item.isFolder) return;
                    if (!userMap.has(item.name)) {
                        userMap.set(item.name, item);
                    } else if (item.previewUrl) {
                        // Se já existe mas o novo tem preview, atualizar
                        userMap.get(item.name).previewUrl = item.previewUrl;
                    }
                });
                
                allProcessedItems.push(...Array.from(userMap.values()));
            } else {
                // DENTRO DE UMA PASTA DE USUÁRIO (currentPath é o UserId)
                // 1. Legado: form-images/{UserId}/*
                const legacyFiles = await processBucketItems('form-images', currentPath);
                // 2. Novo: sync-bucket/users/{UserId}/images/*
                const newFiles = await processBucketItems('sync-bucket', `users/${currentPath}/images`);

                allProcessedItems.push(...legacyFiles, ...newFiles);
            }

            // Fetch metadata for folders if we are at root
            let enrichedItems = allProcessedItems;
            const folderNames = allProcessedItems.filter((item) => item.isFolder).map((item) => item.name);

            if (folderNames.length > 0 && !currentPath) {
                const uniqueFolderNames = Array.from(new Set(folderNames));
                try {
                    const { data: metaRows, error: metaError } = await supabase
                        .from("suite")
                        .select(`owner_id, created_at, payload_json`)
                        .in("owner_id", uniqueFolderNames);

                    if (!metaError && metaRows) {
                        const metaMap = new Map();
                        metaRows.forEach((row: any) => {
                            if (!metaMap.has(row.owner_id)) {
                                const dados = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json;
                                metaMap.set(row.owner_id, {
                                    formTitle: dados?.contexto?.form_titulo || null,
                                    recordDate: dados?.contexto?.data_registro || row.created_at,
                                });
                            }
                        });

                        enrichedItems = allProcessedItems.map(item => {
                            if (!item.isFolder) return item;
                            const meta = metaMap.get(item.name);
                            return {
                                ...item,
                                formTitle: meta?.formTitle || null,
                                recordDate: meta?.recordDate || null
                            };
                        });
                    }
                } catch (e) {
                    console.warn("Falha ao enriquecer pastas:", e);
                }
            }

            setItems(enrichedItems);
        } catch (err) {
            console.error("Error fetching gallery:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems(path);
    }, [path]);

    const handleNavigate = (folderName: string) => {
        setPath(path ? `${path}/${folderName}` : folderName);
    };

    const handleBack = () => {
        const parts = path.split("/");
        parts.pop();
        setPath(parts.join("/"));
    };

    const handleDeleteImage = async (item: GalleryItem) => {
        if (!confirm(`Tem certeza que deseja excluir a imagem "${item.name}"?`)) return;
        try {
            const { error } = await supabase.storage.from("form-images").remove([item.path]);
            if (error) throw error;
            setItems(prev => prev.filter(i => i.path !== item.path));
            setSelectedImage(null);
        } catch (err) {
            console.error("Erro ao excluir:", err);
            alert("Erro ao excluir imagem.");
        }
    };

    function formatDisplayDate(val: any) {
        if (!val) return null;
        try {
            const date = new Date(val);
            if (isNaN(date.getTime())) return null;
            return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
        } catch { return null; }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                {path && (
                    <Button variant="outline" size="sm" onClick={handleBack}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>
                )}
                <h2 className="text-lg font-semibold text-gray-700">
                    {path ? `Pasta: ${path}` : "Galeria Principal"}
                </h2>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : items.length === 0 ? (
                <div className="text-center p-12 text-gray-400 border border-dashed rounded-lg">
                    Nenhum item encontrado nesta pasta.
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {items.map((item) => (
                        <Card
                            key={item.path}
                            className="overflow-hidden hover:shadow-md transition-all cursor-pointer group border-slate-200"
                            onClick={() => item.isFolder ? handleNavigate(item.name) : setSelectedImage(item)}
                        >
                            <CardContent className="p-0">
                                <AspectRatio ratio={1} className="bg-slate-50 flex items-center justify-center">
                                    {item.isFolder ? (
                                        item.previewUrl ? (
                                            <div className="relative w-full h-full">
                                                <img
                                                    src={item.previewUrl}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                    <Folder className="w-12 h-12 text-white drop-shadow-md" />
                                                </div>
                                            </div>
                                        ) : (
                                            <Folder className="w-16 h-16 text-blue-300" />
                                        )
                                    ) : (
                                        <img
                                            src={item.url}
                                            alt={item.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                            loading="lazy"
                                        />
                                    )}
                                </AspectRatio>
                                <div className="p-3 bg-white">
                                    <p className="text-xs font-bold truncate text-slate-900" title={item.name}>{item.name}</p>
                                    {item.isFolder && (
                                        <div className="mt-1">
                                            <p className="text-[10px] text-slate-500 truncate">{item.formTitle || "Usuário"}</p>
                                            {item.recordDate && (
                                                <p className="text-[10px] text-slate-400">{formatDisplayDate(item.recordDate)}</p>
                                            )}
                                        </div>
                                    )}
                                    {!item.isFolder && item.metadata?.size && (
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {(item.metadata.size / 1024).toFixed(1)} KB
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <ImageDialog
                open={!!selectedImage}
                onOpenChange={(open) => !open && setSelectedImage(null)}
                imageUrl={selectedImage?.url || null}
                meta={selectedImage ? {
                    name: selectedImage.name,
                    uploadedAt: selectedImage.metadata?.created_at ? new Date(selectedImage.metadata.created_at).getTime().toString() : undefined
                } : undefined}
                onDelete={selectedImage ? () => handleDeleteImage(selectedImage) : undefined}
            />
        </div>
    );
}

