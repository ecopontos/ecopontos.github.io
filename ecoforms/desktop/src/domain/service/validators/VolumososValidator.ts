import { assertCapacidade, isBairroAtendido } from 'ecoforms-core';
import type { ServiceSlot } from '../ServiceSlot';
import type { CreateBookingInput, ServiceValidator } from './ServiceValidator';

export class VolumososValidator implements ServiceValidator {
    validate(slot: ServiceSlot, input: CreateBookingInput): void {
        const vagas = input.vagasSolicitadas ?? 1;
        assertCapacidade(slot.capacidade, slot.vagasOcupadas, vagas, 'Volumosos');

        if (!input.bairro) {
            throw new Error('Coleta de Volumosos: bairro é obrigatório.');
        }

        const atendido = isBairroAtendido(slot.bairros, input.bairro);
        if (!atendido) {
            throw new Error(`O bairro "${input.bairro}" não é atendido neste slot.`);
        }
    }
}
