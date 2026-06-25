import { describe, it, expect, beforeEach } from 'vitest';
import { UserWidgetInstance } from '../../../domain/widget/UserWidgetInstance';
import { AddWidgetToDashboardUseCase, UpdateWidgetUseCase, RemoveWidgetUseCase } from '../WidgetUseCases';
import { InMemoryUserWidgetInstanceRepository } from '../../../test/fakes/InMemoryUserWidgetInstanceRepository';

describe('UserWidgetInstance domain', () => {
    const now = '2026-05-08T12:00:00.000Z';

    it('fromRow deve criar entidade', () => {
        const w = UserWidgetInstance.fromRow({
            id: 'w-1', user_id: 'u-1', dashboard_id: 'd-1',
            widget_type: 'kpi_card', data_source: '{}', display_config: '{}',
            position_x: 0, position_y: 0, position_w: 6, position_h: 1, position_order: 0,
            criado_em: now, atualizado_em: now,
        });
        expect(w.id).toBe('w-1');
        expect(w.widget_type).toBe('kpi_card');
        expect(w.position_w).toBe(6);
    });

    it('toRow deve serializar', () => {
        const w = UserWidgetInstance.fromProps({
            id: 'w-2', user_id: 'u-1', dashboard_id: 'd-1',
            widget_type: 'bar_chart', data_source: '{"field":"status"}', display_config: '{"title":"Gráfico"}',
            position_x: 0, position_y: 1, position_w: 12, position_h: 2, position_order: 0,
            criado_em: now, atualizado_em: now,
        });
        const row = w.toRow();
        expect(row.widget_type).toBe('bar_chart');
        expect(row.position_w).toBe(12);
    });
});

describe('AddWidgetToDashboardUseCase', () => {
    let repo: InMemoryUserWidgetInstanceRepository;
    let sut: AddWidgetToDashboardUseCase;

    beforeEach(() => {
        repo = new InMemoryUserWidgetInstanceRepository();
        sut = new AddWidgetToDashboardUseCase(repo);
    });

    it('deve adicionar widget ao dashboard', async () => {
        const w = await sut.execute({
            userId: 'u-1', dashboardId: 'd-1',
            widgetType: 'kpi_card',
            dataSource: { entity_type: 'inspecao', aggregation: 'COUNT' },
            displayConfig: { title: 'Total Inspeções' },
        });
        expect(w.id).toBeDefined();
        expect(w.widget_type).toBe('kpi_card');
        expect(w.user_id).toBe('u-1');
    });

    it('deve salvar widget no repositório', async () => {
        const w = await sut.execute({
            userId: 'u-1', dashboardId: 'd-1',
            widgetType: 'bar_chart',
            dataSource: { entity_type: 'inspecao' },
            displayConfig: { title: 'Gráfico' },
        });
        const saved = await repo.findById(w.id);
        expect(saved).not.toBeNull();
        expect(saved!.widget_type).toBe('bar_chart');
    });
});

describe('UpdateWidgetUseCase', () => {
    let repo: InMemoryUserWidgetInstanceRepository;
    let sut: UpdateWidgetUseCase;

    beforeEach(async () => {
        repo = new InMemoryUserWidgetInstanceRepository();
        sut = new UpdateWidgetUseCase(repo);
        const add = new AddWidgetToDashboardUseCase(repo);
        await add.execute({
            userId: 'u-1', dashboardId: 'd-1',
            widgetType: 'kpi_card',
            dataSource: { aggregation: 'COUNT' },
            displayConfig: { title: 'Original' },
        });
    });

    it('deve atualizar display_config', async () => {
        const widgets = await repo.findByUserId('u-1');
        const w = widgets[0];

        const updated = await sut.execute({
            widgetId: w.id, userId: 'u-1',
            displayConfig: { title: 'Atualizado' },
        });
        const parsed = JSON.parse(updated.display_config);
        expect(parsed.title).toBe('Atualizado');
    });

    it('deve lançar erro se widget não existe', async () => {
        await expect(sut.execute({ widgetId: 'inexistente', userId: 'u-1' }))
            .rejects.toThrow('not found');
    });

    it('deve lançar erro se user_id não corresponde', async () => {
        const widgets = await repo.findByUserId('u-1');
        await expect(sut.execute({ widgetId: widgets[0].id, userId: 'u-2' }))
            .rejects.toThrow('another user');
    });
});

describe('RemoveWidgetUseCase', () => {
    let repo: InMemoryUserWidgetInstanceRepository;
    let sut: RemoveWidgetUseCase;

    beforeEach(async () => {
        repo = new InMemoryUserWidgetInstanceRepository();
        sut = new RemoveWidgetUseCase(repo);
        const add = new AddWidgetToDashboardUseCase(repo);
        await add.execute({
            userId: 'u-1', dashboardId: 'd-1',
            widgetType: 'kpi_card',
            dataSource: {}, displayConfig: {},
        });
    });

    it('deve remover widget', async () => {
        const widgets = await repo.findByUserId('u-1');
        await sut.execute(widgets[0].id, 'u-1');
        expect(await repo.findByUserId('u-1')).toHaveLength(0);
    });

    it('deve lançar erro se user_id não corresponde', async () => {
        const widgets = await repo.findByUserId('u-1');
        await expect(sut.execute(widgets[0].id, 'u-2'))
            .rejects.toThrow('another user');
    });
});
