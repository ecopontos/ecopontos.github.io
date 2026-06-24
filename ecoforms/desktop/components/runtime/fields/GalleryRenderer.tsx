"use client";

import { ChangeEvent, useState } from "react";
import { FormField } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Camera, X, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ImageDialog } from "@/components/gallery/ImageDialog";

export interface GalleryItem {
    name: string;
    size?: number;
    type?: string;
    lastModified?: number;
    virtualUrl?: string;
    url?: string;
    uri?: string;
    preview?: string;
    file?: File;
}

interface GalleryRendererProps {
    field: FormField;
    value: GalleryItem[];
    onChange: (value: GalleryItem[]) => void;
    readOnly?: boolean;
}

export function GalleryRenderer({ field, value = [], onChange, readOnly = false }: GalleryRendererProps) {
    // Value expected to be array of objects: { name, size, type, url? } 
    const [viewingImage, setViewingImage] = useState<GalleryItem | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (readOnly) return;
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // In a real app, we would upload these to storage here or pass File objects up
        // For this MVP, we store metadata
        const newFiles = files.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            virtualUrl: URL.createObjectURL(file), // For preview
            file: file // Keep the original File object for upload
        }));

        onChange([...(value || []), ...newFiles]);

        // Reset input
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        if (readOnly) return;
        const newValue = [...(value || [])];
        newValue.splice(index, 1);
        onChange(newValue);
    };

    const getImageUrl = (file: GalleryItem) => {
        return file.virtualUrl || file.url || file.uri || file.preview;
    };

    return (
        <div className="space-y-4">
            {!readOnly && (
                <div className="flex items-center gap-4">
                    <Button variant="secondary" className="relative cursor-pointer">
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                        />
                        <Upload className="mr-2 h-4 w-4" />
                        Adicionar Fotos
                    </Button>
                    <div className="text-xs text-muted-foreground">
                        {value?.length || 0} fotos selecionadas
                    </div>
                </div>
            )}

            {value && value.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {value.map((file, index) => {
                         const src = getImageUrl(file);
                         return (
                            <div 
                                key={index} 
                                className="relative group border rounded-md overflow-hidden aspect-square bg-slate-100 flex items-center justify-center cursor-pointer"
                                onClick={() => src && setViewingImage(file)}
                            >
                                {src ? (
                                    <img src={src} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-8 h-8 text-slate-300" />
                                )}

                                {!readOnly && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="h-8 w-8 rounded-full"
                                            onClick={() => removeFile(index)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                                <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] p-1 truncate text-center">
                                    {file.name}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ImageDialog 
                open={!!viewingImage}
                onOpenChange={(open) => !open && setViewingImage(null)}
                imageUrl={viewingImage ? (getImageUrl(viewingImage) ?? null) : null}
                meta={viewingImage ? { name: viewingImage.name } : undefined}
            />
        </div>
    );
}
