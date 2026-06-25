import type { ServiceSlotRepository } from '../../domain/service/ServiceSlotRepository';

export class CancelServiceSlotUseCase {
    constructor(private readonly repo: ServiceSlotRepository) {}

    async execute(slotId: string): Promise<void> {
        const slot = await this.repo.findById(slotId);
        if (!slot) throw new Error('Slot não encontrado');
        slot.transitionTo('cancelado');
        await this.repo.save(slot);
    }
}
