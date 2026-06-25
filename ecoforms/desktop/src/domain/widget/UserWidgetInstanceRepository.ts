import type { UserWidgetInstance } from './UserWidgetInstance';

export interface UserWidgetInstanceRepository {
    findById(id: string): Promise<UserWidgetInstance | null>;
    findByDashboardId(dashboardId: string): Promise<UserWidgetInstance[]>;
    findByUserId(userId: string): Promise<UserWidgetInstance[]>;
    save(widget: UserWidgetInstance): Promise<void>;
    delete(id: string): Promise<void>;
    updatePositions(updates: Array<{
        id: string; x: number; y: number; w: number; h: number; order: number;
    }>): Promise<void>;
}
