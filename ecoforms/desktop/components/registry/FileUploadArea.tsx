import { useRef, useCallback } from "react";
import { Upload } from "lucide-react";

interface FileUploadAreaProps {
    onFile: (file: File) => void;
    onError?: (message: string) => void;
}

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function FileUploadArea({ onFile, onError }: FileUploadAreaProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = useCallback((file: File): string | null => {
        const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return `Tipo de arquivo não suportado. Use CSV ou XLSX.`;
        }
        if (file.size > MAX_FILE_SIZE) {
            return `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB.`;
        }
        if (file.size === 0) {
            return `Arquivo vazio.`;
        }
        return null;
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (!file) return;
            
            const error = validateFile(file);
            if (error) {
                onError?.(error);
                return;
            }
            onFile(file);
        },
        [onFile, onError, validateFile]
    );

    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            const error = validateFile(file);
            if (error) {
                onError?.(error);
                return;
            }
            onFile(file);
        },
        [onFile, onError, validateFile]
    );

    return (
        <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
        >
            <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <p className="text-sm text-gray-600 mb-1">
                Arraste um arquivo aqui ou <span className="text-blue-600 underline">clique para selecionar</span>
            </p>
            <p className="text-xs text-gray-400">CSV, XLSX (máx. 10MB)</p>
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleFileSelect}
            />
        </div>
    );
}
