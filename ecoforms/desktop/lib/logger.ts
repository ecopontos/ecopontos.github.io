/**
 * Structured Logger for EcoForms
 * Substitui console.log por logs estruturados e tipados.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    timestamp: string;
}

class Logger {
    private static formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
        return {
            level,
            message,
            context,
            timestamp: new Date().toISOString(),
        };
    }

    private static print(entry: LogEntry) {
        const style = {
            debug: 'color: #888',
            info: 'color: #00bcd4',
            warn: 'color: #ff9800',
            error: 'color: #f44336; font-weight: bold',
        };

        if (process.env.NODE_ENV === 'development') {
            console.groupCollapsed(`%c[${entry.level.toUpperCase()}] ${entry.message}`, style[entry.level]);
            if (entry.context) console.log(entry.context);
            console.log(`Time: ${entry.timestamp}`);
            console.groupEnd();
        } else {
            // Em produção, isso poderia enviar para Sentry ou arquivo
            if (entry.level === 'error') {
                console.error(JSON.stringify(entry));
            } else {
                console.log(JSON.stringify(entry));
            }
        }
    }

    static debug(message: string, context?: Record<string, unknown>) {
        this.print(this.formatEntry('debug', message, context));
    }

    static info(message: string, context?: Record<string, unknown>) {
        this.print(this.formatEntry('info', message, context));
    }

    static warn(message: string, context?: Record<string, unknown>) {
        this.print(this.formatEntry('warn', message, context));
    }

    static error(message: string, error?: unknown, context?: Record<string, unknown>) {
        this.print(this.formatEntry('error', message, { ...context, error }));
    }
}

export const logger = Logger;
