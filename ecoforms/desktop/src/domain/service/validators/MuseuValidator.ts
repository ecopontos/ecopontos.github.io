import { assertCapacidade } from 'ecoforms-core';
import type { ServiceSlot } from '../ServiceSlot';
import type { CreateBookingInput, ServiceValidator } from './ServiceValidator';

export class MuseuValidator implements ServiceValidator {
    validate(slot: ServiceSlot, input: CreateBookingInput): void {
        const vagas = input.vagasSolicitadas ?? 1;
        assertCapacidade(slot.capacidade, slot.vagasOcupadas, vagas, 'Museu');
    }
}
