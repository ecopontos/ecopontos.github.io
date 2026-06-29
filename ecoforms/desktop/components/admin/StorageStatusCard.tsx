"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Cloud, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useFileStorage } from "@/src/interface/hooks/catalog/utils";

export function StorageStatusCard() {
    const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'idle'>('idle');
    const [error, setError] = useState<string | null>(null);
    const fileStorage = useFileStorage();

    const checkConnectivity = useCallback(async () => {
        setStatus('checking');
        setError(null);
        try {
            await fileStorage.list('sync-bucket', 'health-check');
            setStatus('connected');
        } catch (err: unknown) {
            console.error('Erro ao verificar storage:', err);
            setStatus('error');
            const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao acessar o Supabase Storage";
            setError(errorMessage);
        }
    }, [fileStorage]);

    useEffect(() => {
        checkConnectivity();
    }, [checkConnectivity]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Cloud className="h-4 w-4" />
                    Conectividade Cloud
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${status === 'connected' ? 'bg-green-100 text-green-600' :
                            status === 'error' ? 'bg-red-100 text-red-600' :
                                'bg-gray-100 text-gray-600'
                            }`}>
                            <Cloud className="h-4 w-4" />
                        </div>
                        <div className="text-xs">
                            <p className="font-medium">Supabase Storage</p>
                            <p className="text-gray-500">sync-bucket</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {status === 'checking' && <RefreshCw className="h-3 w-3 animate-spin text-gray-400" />}
                        {status === 'connected' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                        {status === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={checkConnectivity}>
                            <RefreshCw className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
                {error && (
                    <Alert variant="destructive" className="py-2">
                        <AlertDescription className="text-[10px] leading-tight font-mono">
                            {error}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
