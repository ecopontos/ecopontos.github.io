import type { UserWidgetInstanceRepository } from '../../domain/widget/UserWidgetInstanceRepository';
import { UserWidgetInstance } from '../../domain/widget/UserWidgetInstance';
import { uuidv7 } from 'ecoforms-core';

export class AddWidgetToDashboardUseCase {
    constructor(private repo: UserWidgetInstanceRepository) {}

    async execute(params: {
        userId: string;
        dashboardId: string;
        widgetType: string;
        dataSource: Record<string, unknown>;
        displayConfig: Record<string, unknown>;
        position?: { x: number; y: number; w: number; h: number };
    }): Promise<UserWidgetInstance> {
        const now = new Date().toISOString();
        const widget = UserWidgetInstance.fromProps({
            id: uuidv7(),
            user_id: params.userId,
            dashboard_id: params.dashboardId,
            widget_type: params.widgetType as import('../../domain/widget/UserWidgetInstance').WidgetType,
            data_source: JSON.stringify(params.dataSource),
            display_config: JSON.stringify(params.displayConfig),
            position_x: params.position?.x ?? 0,
            position_y: params.position?.y ?? 0,
            position_w: params.position?.w ?? 6,
            position_h: params.position?.h ?? 1,
            position_order: 0,
            criado_em: now,
            atualizado_em: now,
        });
        await this.repo.save(widget);
        return widget;
    }
}

export class UpdateWidgetUseCase {
    constructor(private repo: UserWidgetInstanceRepository) {}

    async execute(params: {
        widgetId: string;
        dataSource?: Record<string, unknown>;
        displayConfig?: Record<string, unknown>;
        position?: { x: number; y: number; w: number; h: number };
        userId: string;
    }): Promise<UserWidgetInstance> {
        const existing = await this.repo.findById(params.widgetId);
        if (!existing) throw new Error('Widget not found');
        if (existing.user_id !== params.userId) throw new Error('Cannot edit another user\'s widget');

        const updated = UserWidgetInstance.fromProps({
            ...existing['props'],
            data_source: params.dataSource ? JSON.stringify(params.dataSource) : existing.data_source,
            display_config: params.displayConfig ? JSON.stringify(params.displayConfig) : existing.display_config,
            position_x: params.position?.x ?? existing.position_x,
            position_y: params.position?.y ?? existing.position_y,
            position_w: params.position?.w ?? existing.position_w,
            position_h: params.position?.h ?? existing.position_h,
            atualizado_em: new Date().toISOString(),
        });
        await this.repo.save(updated);
        return updated;
    }
}

export class ListUserWidgetsUseCase {
    constructor(private repo: UserWidgetInstanceRepository) {}

    async execute(userId: string): Promise<UserWidgetInstance[]> {
        return this.repo.findByUserId(userId);
    }
}

export class RemoveWidgetUseCase {
    constructor(private repo: UserWidgetInstanceRepository) {}

    async execute(widgetId: string, userId: string): Promise<void> {
        const existing = await this.repo.findById(widgetId);
        if (!existing) throw new Error('Widget not found');
        if (existing.user_id !== userId) throw new Error('Cannot delete another user\'s widget');
        await this.repo.delete(widgetId);
    }
}
