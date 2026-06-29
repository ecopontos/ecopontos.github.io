export type WsMessageHandler = (data: Record<string, unknown>) => void;

type UnlistenFn = () => void;

export class LanWebSocketClient {
    private listeners = new Map<string, Set<WsMessageHandler>>();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempt = 0;
    private maxReconnectDelay = 30_000;
    private shouldReconnect = false;
    private authenticated = false;
    private unlisteners: UnlistenFn[] = [];

    constructor(
        private hubUrl: string,
        private deviceId: string,
        private displayName: string,
        private authToken?: string,
    ) {}

    connect(): void {
        this.shouldReconnect = true;
        this.reconnectAttempt = 0;
        this.authenticated = false;
        void this.doConnect();
    }

    disconnect(): void {
        this.shouldReconnect = false;
        this.authenticated = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        for (const fn of this.unlisteners) fn();
        this.unlisteners = [];
        void this.invokeDisconnect();
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
        if (!this.authenticated) return;
        void this.invokeSend(JSON.stringify(message));
    }

    get connected(): boolean {
        return this.authenticated;
    }

    private async doConnect(): Promise<void> {
        // Clear old listeners before reconnecting
        for (const fn of this.unlisteners) fn();
        this.unlisteners = [];

        const { invoke } = await import('@tauri-apps/api/core');
        const { listen: tauriListen } = await import('@tauri-apps/api/event');

        try {
            // Subscribe to Tauri events before connecting
            const unMsg = await tauriListen<string>('lan-ws-message', (ev) => {
                try {
                    const data = JSON.parse(ev.payload) as Record<string, unknown>;
                    if (!this.authenticated) return;
                    const msgType = data.type as string;
                    if (msgType) this.emit(msgType, data);
                } catch {
                    // ignore malformed messages
                }
            });

            const unState = await tauriListen<Record<string, unknown>>('lan-ws-state', (ev) => {
                const payload = ev.payload;
                const wsState = payload.state as string;
                if (wsState === 'connected') {
                    this.reconnectAttempt = 0;
                    this.authenticated = true;
                    this.emit('connected', payload);
                } else if (wsState === 'auth_failed') {
                    this.authenticated = false;
                    this.shouldReconnect = false;
                    this.emit('auth_failed', payload);
                } else if (wsState === 'disconnected') {
                    this.authenticated = false;
                    this.emit('disconnected', payload);
                    if (this.shouldReconnect) {
                        this.scheduleReconnect();
                    }
                }
            });

            this.unlisteners.push(unMsg, unState);

            await invoke('lan_ws_connect', {
                url: this.hubUrl,
                deviceId: this.deviceId,
                displayName: this.displayName,
                authToken: this.authToken ?? '',
            });
        } catch {
            this.scheduleReconnect();
        }
    }

    private async invokeSend(message: string): Promise<void> {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('lan_ws_send', { message });
        } catch {
            // send failure — will rely on disconnected event to trigger reconnect
        }
    }

    private async invokeDisconnect(): Promise<void> {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('lan_ws_disconnect');
        } catch {
            // ignore disconnect errors
        }
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
                void this.doConnect();
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
