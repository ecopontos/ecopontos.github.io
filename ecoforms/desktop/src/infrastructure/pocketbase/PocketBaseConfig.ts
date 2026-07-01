export interface PocketBaseConfig {
    enabled: boolean;
    baseUrl: string;
    timeoutMs: number;
    tipoResiduoCollection: string;
}

function readEnv(name: string): string | undefined {
    return process.env[name];
}

function readBooleanEnv(name: string): boolean {
    const value = readEnv(name);
    return value === '1' || value === 'true' || value === 'yes';
}

function normalizeBaseUrl(value: string | undefined): string {
    return (value ?? '').trim().replace(/\/+$/, '');
}

function readTimeoutMs(): number {
    const raw = Number(readEnv('NEXT_PUBLIC_POCKETBASE_TIMEOUT_MS'));
    return Number.isFinite(raw) && raw > 0 ? raw : 5_000;
}

export function getPocketBaseConfig(): PocketBaseConfig {
    const baseUrl = normalizeBaseUrl(readEnv('NEXT_PUBLIC_POCKETBASE_URL'));
    const enabled = readBooleanEnv('NEXT_PUBLIC_POCKETBASE_ENABLED') && baseUrl.length > 0;

    return {
        enabled,
        baseUrl,
        timeoutMs: readTimeoutMs(),
        tipoResiduoCollection: readEnv('NEXT_PUBLIC_POCKETBASE_TIPO_RESIDUO_COLLECTION') ?? 'tipos_residuo',
    };
}
