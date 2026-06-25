export type WsMessageHandler = (data: Record<string, unknown>) => void;

export class LanWebSocketClient {
    private ws: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private listeners = new Map<string, Set<WsMessageHandler>>();
    private reconnectAttempt = 0;
    private maxReconnectDelay = 30_000;
    private shouldReconnect = false;

    constructor(
        private hubUrl: string,
        private deviceId: string,
        private displayName: string,
    ) {}

    connect(): void {
        this.shouldReconnect = true;
        this.reconnectAttempt = 0;
        this.doConnect();
    }

    disconnect(): void {
        this.shouldReconnect = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    on(messageType: string, handler: WsMessageHandler): () => void {
        if (!this.listeners.has(messageType)) {
            this.listeners.set(messageType, new Set());
        }
        this.listeners.get(messageType)!.add(handler);
        return () => {
            this.listeners.get(messageType)?.delete(handler);
        };
    }

    send(message: Record<string, unknown>): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    get connected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    private doConnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        try {
            this.ws = new WebSocket(this.hubUrl);
        } catch {
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            this.reconnectAttempt = 0;
            this.send({
                type: 'auth',
                device_id: this.deviceId,
                display_name: this.displayName,
            });
            this.emit('connected', {});
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data as string) as Record<string, unknown>;
                const msgType = data.type as string;
                if (msgType) {
                    this.emit(msgType, data);
                }
            } catch {
                // ignore malformed messages
            }
        };

        this.ws.onclose = () => {
            this.emit('disconnected', {});
            if (this.shouldReconnect) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = () => {
            // onclose will fire after onerror
        };
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        const delay = Math.min(
            1000 * Math.pow(2, this.reconnectAttempt),
            this.maxReconnectDelay,
        );
        this.reconnectAttempt++;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.shouldReconnect) {
                this.doConnect();
            }
        }, delay);
    }

    private emit(type: string, data: Record<string, unknown>): void {
        this.listeners.get(type)?.forEach((handler) => {
            try { handler(data); } catch { /* swallow handler errors */ }
        });
        this.listeners.get('*')?.forEach((handler) => {
            try { handler({ ...data, type }); } catch { /* swallow */ }
        });
    }
}
