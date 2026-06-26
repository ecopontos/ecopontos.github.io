import type { ModuleVisualViewRepository } from '../../domain/visual/ModuleVisualViewRepository';
import { ModuleVisualView } from '../../domain/visual/ModuleVisualView';
import type { VisualType } from '../../domain/visual/ModuleVisualView';
import type { SyncOutbox } from '../ports/SyncOutboxPort';
import { validateViewConfig } from './validation';
import { uuidv7 } from 'ecoforms-core';

export class CreateViewUseCase {
    constructor(
        private repo: ModuleVisualViewRepository,
        private sync?: SyncOutbox,
    ) {}

    async execute(
        moduleId: string,
        visualType: VisualType,
        name: string,
        config: Record<string, unknown>,
        userId?: string,
    ): Promise<ModuleVisualView> {
        const validated = validateViewConfig(config, visualType);

        const id = uuidv7();
        const now = new Date().toISOString();

        const view = ModuleVisualView.fromProps({
            id,
            module_id: moduleId,
            visual_type: visualType,
            name,
            config: JSON.stringify(validated),
            is_default: false,
            user_id: userId ?? null,
            parent_view_id: null,
            sync_status: 'synced',
            position: 0,
            criado_em: now,
            atualizado_em: now,
        });

        await this.repo.save(view);
        await this.sync?.write('module.view.criada', { viewId: id, moduleId, userId: userId ?? null },
            { aggregateId: id, streamId: moduleId });
        return view;
    }
}

export class UpdateViewUseCase {
    constructor(
        private repo: ModuleVisualViewRepository,
        private sync?: SyncOutbox,
    ) {}

    async execute(
        viewId: string,
        config: Record<string, unknown>,
        userId?: string,
    ): Promise<ModuleVisualView> {
        const existing = await this.repo.findById(viewId);
        if (!existing) throw new Error(`View ${viewId} not found`);

        if (existing.user_id !== null && existing.user_id !== userId) {
            throw new Error('Cannot edit another user\'s personal view');
        }

        const validated = validateViewConfig(config, existing.visual_type);
        const updated = existing.updateConfig(JSON.stringify(validated));
        await this.repo.save(updated);
        await this.sync?.write('module.view.atualizada', { viewId, moduleId: existing.module_id },
            { aggregateId: viewId, streamId: existing.module_id });
        return updated;
    }
}

export class DeleteViewUseCase {
    constructor(
        private repo: ModuleVisualViewRepository,
        private sync?: SyncOutbox,
    ) {}

    async execute(viewId: string, userId?: string): Promise<void> {
        const existing = await this.repo.findById(viewId);
        if (!existing) throw new Error(`View ${viewId} not found`);

        if (existing.user_id !== null && existing.user_id !== userId) {
            throw new Error('Cannot delete another user\'s personal view');
        }

        await this.repo.delete(viewId);
        await this.sync?.write('module.view.deletada', { viewId, moduleId: existing.module_id },
            { aggregateId: viewId, streamId: existing.module_id });
    }
}

export class SetDefaultViewUseCase {
    constructor(private repo: ModuleVisualViewRepository) {}

    async execute(viewId: string): Promise<void> {
        const view = await this.repo.findById(viewId);
        if (!view) throw new Error(`View ${viewId} not found`);
        await this.repo.setDefault(viewId, view.module_id, view.visual_type);
    }
}

export class CopyViewToPersonalUseCase {
    constructor(private repo: ModuleVisualViewRepository) {}

    async execute(globalViewId: string, userId: string): Promise<ModuleVisualView> {
        const global = await this.repo.findById(globalViewId);
        if (!global || global.user_id !== null) {
            throw new Error('Global view not found');
        }

        const now = new Date().toISOString();
        const personal = ModuleVisualView.fromProps({
            id: uuidv7(),
            module_id: global.module_id,
            visual_type: global.visual_type,
            name: global.name,
            config: global.config,
            is_default: false,
            user_id: userId,
            parent_view_id: global.id,
            sync_status: 'synced',
            position: global.position,
            criado_em: now,
            atualizado_em: now,
        });

        await this.repo.save(personal);
        return personal;
    }
}

export class SyncPersonalViewUseCase {
    constructor(private repo: ModuleVisualViewRepository) {}

    async execute(globalViewId: string): Promise<void> {
        const globalView = await this.repo.findById(globalViewId);
        if (!globalView || globalView.user_id !== null) {
            throw new Error('Global view not found');
        }

        const personalViews = await this.repo.findByParentId(globalViewId);
        for (const personal of personalViews) {
            const outdated = personal.markOutdated();
            await this.repo.save(outdated);
        }
    }
}
