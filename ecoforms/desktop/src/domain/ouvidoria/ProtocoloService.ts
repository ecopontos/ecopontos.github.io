/**
 * ADR-013 1.1 — Serviço de geração automática de protocolo (NUP)
 * Formato: ANO-NNNNN (ex: 2026-00042)
 * Sequência controlada por tabela protocolo_seq para evitar colisão em multi-device.
 *
 * ADR-041 Gap 1: o domínio não conhece persistência. A leitura/escrita da sequência
 * é abstraída por `ProximoProtocoloPort`, cuja implementação SQLite vive na infraestrutura.
 */
export interface ProximoProtocoloPort {
    /** Último número emitido no ano, ou `null` se ainda não há sequência para o ano. */
    getUltimo(ano: number): Promise<number | null>;
    /** Persiste (upsert) o último número emitido no ano. */
    setUltimo(ano: number, valor: number): Promise<void>;
}

export class ProtocoloService {
    constructor(private readonly port: ProximoProtocoloPort) {}

    async gerar(): Promise<string> {
        const ano = new Date().getFullYear();
        const ultimo = (await this.port.getUltimo(ano)) ?? 0;
        const proximo = ultimo + 1;
        await this.port.setUltimo(ano, proximo);
        return `${ano}-${String(proximo).padStart(5, '0')}`;
    }
}
