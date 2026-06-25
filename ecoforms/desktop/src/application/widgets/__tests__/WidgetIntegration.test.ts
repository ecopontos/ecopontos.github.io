import { describe, it, expect, beforeEach } from 'vitest';
import { AddWidgetToDashboardUseCase, UpdateWidgetUseCase, RemoveWidgetUseCase } from '../WidgetUseCases';
import { InMemoryUserWidgetInstanceRepository } from '../../../test/fakes/InMemoryUserWidgetInstanceRepository';

describe('Widget Integration Flow', () => {
    let repo: InMemoryUserWidgetInstanceRepository;
    let add: AddWidgetToDashboardUseCase;
    let update: UpdateWidgetUseCase;
    let remove: RemoveWidgetUseCase;

    beforeEach(() => {
        repo = new InMemoryUserWidgetInstanceRepository();
        add = new AddWidgetToDashboardUseCase(repo);
        update = new UpdateWidgetUseCase(repo);
        remove = new RemoveWidgetUseCase(repo);
    });

    it('composer → save → load → verify (full cycle)', async () => {
        const w1 = await add.execute({
            userId: 'user-1',
            dashboardId: 'dash-1',
            widgetType: 'kpi_card',
            dataSource: { entity_type: 'inspecao', aggregation: 'COUNT' },
            displayConfig: { title: 'Total', color: '#3b82f6' },
            position: { x: 0, y: 0, w: 3, h: 1 },
        });

        const w2 = await add.execute({
            userId: 'user-1',
            dashboardId: 'dash-1',
            widgetType: 'bar_chart',
            dataSource: { entity_type: 'inspecao', aggregation: 'COUNT', category_field: 'status' },
            displayConfig: { title: 'Por Status', color: '#10b981' },
            position: { x: 3, y: 0, w: 6, h: 2 },
        });

        // Save (verify in repo)
        const savedW1 = await repo.findById(w1.id);
        expect(savedW1).not.toBeNull();
        expect(savedW1!.widget_type).toBe('kpi_card');

        const savedW2 = await repo.findById(w2.id);
        expect(savedW2).not.toBeNull();
        expect(savedW2!.widget_type).toBe('bar_chart');

        // Load dashboard widgets
        const dashWidgets = await repo.findByDashboardId('dash-1');
        expect(dashWidgets.length).toBe(2);

        // Update
        const parsedConfig = JSON.parse(dashWidgets[0].display_config);
        expect(parsedConfig.title).toBe('Total');

        const updated = await update.execute({
            widgetId: w1.id,
            userId: 'user-1',
            displayConfig: { title: 'Total Inspeções', color: '#ef4444' },
        });
        const updatedParsed = JSON.parse(updated.display_config);
        expect(updatedParsed.title).toBe('Total Inspeções');
        expect(updatedParsed.color).toBe('#ef4444');
    });

    it('deve rejeitar update de widget de outro usuário', async () => {
        const w = await add.execute({
            userId: 'user-1', dashboardId: 'dash-1',
            widgetType: 'kpi_card',
            dataSource: {}, displayConfig: {},
        });

        await expect(update.execute({ widgetId: w.id, userId: 'user-2' }))
            .rejects.toThrow('another user');
    });

    it('deve rejeitar delete de widget de outro usuário', async () => {
        const w = await add.execute({
            userId: 'user-1', dashboardId: 'dash-1',
            widgetType: 'kpi_card',
            dataSource: {}, displayConfig: {},
        });

        await expect(remove.execute(w.id, 'user-2'))
            .rejects.toThrow('another user');
    });

    it('deve permitir reordenação de widgets via updatePositions', async () => {
        const w1 = await add.execute({
            userId: 'user-1', dashboardId: 'dash-1',
            widgetType: 'kpi_card', dataSource: {}, displayConfig: {},
            position: { x: 0, y: 0, w: 6, h: 1 },
        });
        const w2 = await add.execute({
            userId: 'user-1', dashboardId: 'dash-1',
            widgetType: 'bar_chart', dataSource: {}, displayConfig: {},
            position: { x: 6, y: 0, w: 6, h: 1 },
        });

        await repo.updatePositions([
            { id: w1.id, x: 6, y: 0, w: 6, h: 1, order: 1 },
            { id: w2.id, x: 0, y: 0, w: 6, h: 1, order: 0 },
        ]);

        const updated1 = await repo.findById(w1.id);
        expect(updated1!.position_x).toBe(6);
        const updated2 = await repo.findById(w2.id);
        expect(updated2!.position_x).toBe(0);
    });
});
