import type { ServiceSlot } from '../ServiceSlot';

export interface CreateBookingInput {
    dadosFormulario: Record<string, unknown>;
    clienteId: string;
    clienteNome: string;
    vagasSolicitadas?: number;
    bairro?: string;
}

export interface ServiceValidator {
    validate(slot: ServiceSlot, input: CreateBookingInput): Promise<void> | void;
}
