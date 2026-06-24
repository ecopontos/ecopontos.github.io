/**
 * ADR-013 1.1 — Serviço de geração automática de protocolo (NUP)
 * Formato: ANO-NNNNN (ex: 2026-00042)
 * Sequência controlada por tabela protocolo_seq para evitar colisão em multi-device.
 *
 * ADR-041 Gap 1: o domínio não conhece persistência. A leitura/escrita da sequência
 * é abstraída por `ProximoProtocoloPort`, cuja implementação SQLite vive na infraestrutura.
 */
export interface ProximoProtocoloPort {
    /**
     * Reserva e retorna o próximo número de protocolo do ano de forma **atômica**
     * (incremento read-modify-write em um único passo, sem janela de corrida).
     * Corrige RN-O08: a versão anterior (`getUltimo`→`setUltimo`) permitia colisão
     * em `UNIQUE(protocolo)` sob criação concorrente / multi-device no mesmo ano.
     */
    proximo(ano: number): Promise<number>;
}

export class ProtocoloService {
    constructor(private readonly port: ProximoProtocoloPort) {}

    async gerar(): Promise<string> {
        const ano = new Date().getFullYear();
        const proximo = await this.port.proximo(ano);
        return `${ano}-${String(proximo).padStart(5, '0')}`;
    }
}
