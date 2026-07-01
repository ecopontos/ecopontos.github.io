
"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useGalleryStorage } from "@/src/interface/hooks/catalog/utils";
import type { GalleryItem } from "@/src/interface/hooks/catalog/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ImageDialog } from "./ImageDialog";
import { Loader2, Folder, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GalleryGrid() {
    const [path, setPath] = useState<string>("");
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
    const galleryStorage = useGalleryStorage();

    const fetchItems = async (currentPath: string) => {
        setLoading(true);
        try {
            const nextItems = await galleryStorage.listItems(currentPath);
            setItems(nextItems);
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
            await galleryStorage.deleteImage(item);
            setItems(prev => prev.filter(i => i.path !== item.path || i.bucket !== item.bucket));
            setSelectedImage(null);
        } catch (err) {
            console.error("Erro ao excluir:", err);
            alert("Erro ao excluir imagem.");
        }
    };

    function formatDisplayDate(val: string | Date | number | null) {
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

