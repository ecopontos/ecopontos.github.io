import type { UserWidgetInstanceRepository } from '../../domain/widget/UserWidgetInstanceRepository';
import { UserWidgetInstance } from '../../domain/widget/UserWidgetInstance';

export class InMemoryUserWidgetInstanceRepository implements UserWidgetInstanceRepository {
    private widgets = new Map<string, UserWidgetInstance>();

    async findById(id: string): Promise<UserWidgetInstance | null> {
        return this.widgets.get(id) ?? null;
    }

    async findByDashboardId(dashboardId: string): Promise<UserWidgetInstance[]> {
        return [...this.widgets.values()].filter(w => w.dashboard_id === dashboardId);
    }

    async findByUserId(userId: string): Promise<UserWidgetInstance[]> {
        return [...this.widgets.values()].filter(w => w.user_id === userId);
    }

    async save(widget: UserWidgetInstance): Promise<void> {
        this.widgets.set(widget.id, widget);
    }

    async delete(id: string): Promise<void> {
        this.widgets.delete(id);
    }

    async updatePositions(updates: Array<{ id: string; x: number; y: number; w: number; h: number; order: number }>): Promise<void> {
        for (const u of updates) {
            const w = this.widgets.get(u.id);
            if (w) {
                this.widgets.set(u.id, UserWidgetInstance.fromProps({
                    ...w['props'],
                    position_x: u.x, position_y: u.y, position_w: u.w, position_h: u.h, position_order: u.order,
                }));
            }
        }
    }
}
