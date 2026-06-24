import type { LogContext, LoggerPort } from '../../application/ports/LoggerPort';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    context?: LogContext;
    timestamp: string;
}

export class ConsoleLogger implements LoggerPort {
    private isDev = process.env.NODE_ENV === 'development';

    debug(message: string, context?: LogContext): void {
        this.print({ level: 'debug', message, context, timestamp: new Date().toISOString() });
    }

    info(message: string, context?: LogContext): void {
        this.print({ level: 'info', message, context, timestamp: new Date().toISOString() });
    }

    warn(message: string, context?: LogContext): void {
        this.print({ level: 'warn', message, context, timestamp: new Date().toISOString() });
    }

    error(message: string, error?: unknown, context?: LogContext): void {
        this.print({
            level: 'error',
            message,
            context: { ...context, error },
            timestamp: new Date().toISOString(),
        });
    }

    private print(entry: LogEntry) {
        const style: Record<LogLevel, string> = {
            debug: 'color: #888',
            info: 'color: #00bcd4',
            warn: 'color: #ff9800',
            error: 'color: #f44336; font-weight: bold',
        };

        if (this.isDev) {
            console.groupCollapsed(
                `%c[${entry.level.toUpperCase()}] ${entry.message}`,
                style[entry.level],
            );
            if (entry.context) console.log(entry.context);
            console.log(`Time: ${entry.timestamp}`);
            console.groupEnd();
        } else if (entry.level === 'error') {
            console.error(JSON.stringify(entry));
        } else {
            console.log(JSON.stringify(entry));
        }
    }
}
