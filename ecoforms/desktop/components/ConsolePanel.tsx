"use client";

import { useLog } from "@/contexts/LogContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";

export function ConsolePanel() {
    const { logs, clearLogs } = useLog();

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Logs de Depuração</h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={clearLogs}
                    className="flex items-center gap-2"
                >
                    <Trash2 className="h-4 w-4" />
                    Limpar
                </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-md p-4 bg-black text-green-400 font-mono text-sm">
                {logs.length === 0 ? (
                    <div className="text-gray-500">Nenhum log ainda...</div>
                ) : (
                    <div className="space-y-1">
                        {logs.map((log, index) => (
                            <div key={index} className="whitespace-pre-wrap break-words">
                                {log}
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}