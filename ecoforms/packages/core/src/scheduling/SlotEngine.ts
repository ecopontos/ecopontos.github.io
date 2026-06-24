/**
 * Pure functions for slot capacity checks — shared between desktop validators
 * and any future mobile/server scheduling logic.
 */

export function computeVagasLivres(capacidade: number | null | undefined, vagasOcupadas: number): number | null {
    if (capacidade == null) return null;
    return capacidade - vagasOcupadas;
}

export function assertCapacidade(
    capacidade: number | null | undefined,
    vagasOcupadas: number,
    vagasSolicitadas: number,
    tipoLabel?: string
): void {
    if (capacidade == null) return;
    const livres = capacidade - vagasOcupadas;
    if (vagasSolicitadas > livres) {
        const prefixo = tipoLabel ? `${tipoLabel}: ` : '';
        throw new Error(
            livres <= 0
                ? `${prefixo}Capacidade máxima atingida. Este slot não possui vagas disponíveis.`
                : `${prefixo}Vagas insuficientes. Disponíveis: ${livres}. Solicitadas: ${vagasSolicitadas}.`
        );
    }
}

export function isBairroAtendido(bairrosSlot: string[], bairro: string | null | undefined): boolean {
    if (bairrosSlot.length === 0) return true;
    if (!bairro) return false;
    return bairrosSlot.includes(bairro);
}
