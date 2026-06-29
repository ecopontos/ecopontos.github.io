"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface LogContextType {
    logs: string[];
    addLog: (message: string) => void;
    clearLogs: () => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export function LogProvider({ children }: { children: ReactNode }) {
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const clearLogs = () => {
        setLogs([]);
    };
    useEffect(() => {
        // Store originals
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        // Override console.log to capture logs
        console.log = (...args: unknown[]) => {
            originalLog(...args);
            addLog(args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '));
        };

        console.error = (...args: unknown[]) => {
            originalError(...args);
            addLog(`ERROR: ${args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ')}`);
        };

        console.warn = (...args: unknown[]) => {
            originalWarn(...args);
            addLog(`WARN: ${args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ')}`);
        };

        // Cleanup on unmount
        return () => {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
        };
    }, []);

    return (
        <LogContext.Provider value={{ logs, addLog, clearLogs }}>
            {children}
        </LogContext.Provider>
    );
}

export function useLog() {
    const context = useContext(LogContext);
    if (!context) {
        throw new Error("useLog must be used within a LogProvider");
    }
    return context;
}