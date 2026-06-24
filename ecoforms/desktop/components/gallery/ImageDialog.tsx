
"use client";

import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    ZoomIn, 
    ZoomOut, 
    RotateCw, 
    Download, 
    Trash2, 
    X,
    Maximize2,
    RefreshCcw
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface ImageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageUrl: string | null;
    meta?: {
        name: string;
        uploadedAt?: string;
        user?: string;
    };
    onDelete?: () => void;
}

export function ImageDialog({ open, onOpenChange, imageUrl, meta, onDelete }: ImageDialogProps) {
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const resetView = () => {
        setScale(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
    };

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            resetView();
        }
    }, [open, imageUrl]);

    const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 4));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.5, 1));
    const handleRotate = () => setRotation(r => (r + 90) % 360);

    const handleDownload = async () => {
        if (!imageUrl) return;
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = meta?.name || 'download-imagem.jpg';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            console.error("Erro ao baixar imagem", e);
            // Fallback for direct link
            window.open(imageUrl, '_blank');
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true);
            setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            e.preventDefault();
            setPosition({
                x: e.clientX - startPos.x,
                y: e.clientY - startPos.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    if (!imageUrl) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 bg-black/95 border-gray-800 overflow-hidden">
                <DialogHeader className="sr-only">
                    <DialogTitle>{meta?.name || "Visualização de Imagem"}</DialogTitle>
                </DialogHeader>

                {/* Toolbar */}
                <div className="flex items-center justify-between p-2 bg-black/80 z-50 border-b border-white/10">
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleZoomIn} title="Zoom In">
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleZoomOut} disabled={scale <= 1} title="Zoom Out">
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={resetView} title="Resetar Visualização">
                            <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-white/20 mx-2" />
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleRotate} title="Girar 90°">
                            <RotateCw className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleDownload} title="Baixar">
                            <Download className="h-4 w-4" />
                        </Button>
                        {onDelete && (
                            <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-900/20 hover:text-red-300" onClick={onDelete} title="Excluir">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 ml-2" onClick={() => onOpenChange(false)} title="Fechar">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Viewer Area */}
                <div 
                    ref={containerRef}
                    className={`flex-1 relative w-full h-full flex items-center justify-center overflow-hidden bg-neutral-900 ${scale > 1 ? 'cursor-move' : 'cursor-default'}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={(e) => {
                        if (e.ctrlKey) {
                            e.preventDefault();
                            if (e.deltaY < 0) handleZoomIn();
                            else handleZoomOut();
                        }
                    }}
                >
                    <div 
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${scale})`,
                            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                        }}
                        className="relative"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={imageUrl}
                            alt={meta?.name || "Full size view"}
                            className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] object-contain select-none pointer-events-none"
                            draggable={false}
                        />
                    </div>
                </div>

                {/* Footer Info */}
                {(meta?.name || meta?.user) && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white py-2 px-4 rounded-full backdrop-blur-md border border-white/10 flex flex-col items-center pointer-events-none max-w-[80vw]">
                        <h3 className="font-semibold text-sm truncate max-w-full">{meta.name}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-300">
                             {meta.user && <span>👤 {meta.user}</span>}
                             {meta.uploadedAt && <span>📅 {new Date(Number(meta.uploadedAt)).toLocaleString()}</span>}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// Ensure pure export
export default ImageDialog;
