import { assertCapacidade } from 'ecoforms-core';
import type { ServiceSlot } from '../ServiceSlot';
import type { CreateBookingInput, ServiceValidator } from './ServiceValidator';
import { MuseuValidator } from './MuseuValidator';
import { VolumososValidator } from './VolumososValidator';
import { EventoValidator } from './EventoValidator';

const registry: Record<string, () => ServiceValidator> = {
    museu:     () => new MuseuValidator(),
    volumosos: () => new VolumososValidator(),
    evento:    () => new EventoValidator(),
};

export class ServiceValidatorFactory {
    static create(validatorKey: string | null | undefined): ServiceValidator {
        const factory = validatorKey ? registry[validatorKey] : undefined;
        if (!factory) {
            return {
                validate(slot: ServiceSlot, input: CreateBookingInput) {
                    assertCapacidade(slot.capacidade, slot.vagasOcupadas, input.vagasSolicitadas ?? 1);
                },
            };
        }
        return factory();
    }

    static register(key: string, factory: () => ServiceValidator): void {
        registry[key] = factory;
    }
}
