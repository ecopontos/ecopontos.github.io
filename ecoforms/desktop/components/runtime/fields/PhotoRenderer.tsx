import { useState, useEffect } from "react";
import { FormField } from "@/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Camera, X, Image as ImageIcon, RotateCcw } from "lucide-react";

interface PhotoFileValue {
    file?: File;
    name?: string;
    size?: number;
    type?: string;
    lastModified?: number;
    offline_path?: string;
    url?: string;
}

type PhotoValue = File | string | PhotoFileValue | null | undefined;

function getPhotoValueName(value: PhotoValue): string | null {
    if (value instanceof File) {
        return value.name;
    }

    if (value && typeof value === "object" && "name" in value && typeof value.name === "string") {
        return value.name;
    }

    return null;
}

interface PhotoRendererProps {
    field: FormField;
    value: PhotoValue;
    onChange: (value: PhotoValue) => void;
    readOnly?: boolean;
}

export function PhotoRenderer({ field, value, onChange, readOnly = false }: PhotoRendererProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Effect to determine the preview URL based on the value type
    // Effect to determine the preview URL based on the value type
    useEffect(() => {
        let activeUrl: string | null = null;
        let isMounted = true;

        const resolvePath = async (val: PhotoValue) => {
            try {
                // Case 1: Value is a File object
                if (val instanceof File) {
                    const url = URL.createObjectURL(val);
                    activeUrl = url;
                    if (isMounted) setPreviewUrl(url);
                    return;
                }

                // Case 1b: Value.file is File
                if (val && typeof val === 'object' && 'file' in val && val.file instanceof File) {
                    const url = URL.createObjectURL(val.file);
                    activeUrl = url;
                    if (isMounted) setPreviewUrl(url);
                    return;
                }

                // Case 2: Value is string (URL or Local Path)
                if (typeof val === 'string') {
                    // Check if it's a local storage path (storage/...)
                    if (val.startsWith('storage/')) {
                        const { OfflineStorageService } = await import('@/lib/offline-storage');
                        const url = await OfflineStorageService.getInstance().getFileUrl(val);
                        if (isMounted) setPreviewUrl(url);
                    } else {
                        if (isMounted) setPreviewUrl(val);
                    }
                    return;
                }

                // Case 3: Object with offline_path (from DB)
                if (val && typeof val === 'object' && 'offline_path' in val && typeof val.offline_path === 'string') {
                    const { OfflineStorageService } = await import('@/lib/offline-storage');
                    const url = await OfflineStorageService.getInstance().getFileUrl(val.offline_path);
                    if (isMounted) setPreviewUrl(url);
                    return;
                }

                // Case 4: Object with url property
                if (val && typeof val === 'object' && 'url' in val && typeof val.url === 'string') {
                    if (isMounted) setPreviewUrl(val.url);
                    return;
                }

                if (isMounted) setPreviewUrl(null);

            } catch (err) {
                console.error("Error resolving photo preview:", err);
                if (isMounted) setPreviewUrl(null);
            }
        };

        resolvePath(value);

        return () => {
            isMounted = false;
            if (activeUrl) URL.revokeObjectURL(activeUrl);
        };
    }, [value]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Important: Pass the actual File object so FormRenderer can upload it
            // We wrap it to preserve metadata if expected, but FormRenderer checks for .file
            onChange({
                file: file,
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            });
        }
    };

    const handleClear = () => {
        onChange(null);
    };

    return (
        <div className="space-y-4">
            <Label htmlFor={field.id}>
                {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>

            {previewUrl ? (
                <div className="relative group w-full max-w-sm rounded-lg overflow-hidden border border-border bg-muted/20">
                    <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-auto object-cover max-h-[300px]"
                    />

                    {!readOnly && (
                        <div className="absolute top-2 right-2 flex gap-2">
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8 shadow-sm opacity-90 hover:opacity-100 transition-opacity"
                                onClick={handleClear}
                                title="Remover imagem"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 truncate">
                        {getPhotoValueName(value) || (typeof value === 'string' ? 'Imagem salva' : 'Imagem selecionada')}
                    </div>
                </div>
            ) : (
                !readOnly && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                                <Input
                                    id={field.id}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="cursor-pointer pl-10"
                                    disabled={readOnly}
                                />
                                <Camera className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Clique ou arraste uma imagem aqui.
                        </p>
                    </div>
                )
            )}

            {readOnly && !previewUrl && (
                <div className="flex items-center gap-2 p-4 border border-dashed rounded-lg text-muted-foreground bg-muted/10">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm">Nenhuma imagem fornecida</span>
                </div>
            )}
        </div>
    );
}
