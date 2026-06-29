import { describe, it, expect, vi } from 'vitest';
import { CreateModuleUseCase } from '../../../application/module/CreateModuleUseCase';
import { PublishModuleUseCase } from '../../../application/module/PublishModuleUseCase';
import { UpdateModuleConfigUseCase } from '../../../application/module/UpdateModuleConfigUseCase';
import { ListModulesUseCase } from '../../../application/module/ListModulesUseCase';
import { GetModuleRuntimeUseCase } from '../../../application/module/GetModuleRuntimeUseCase';
import { InMemoryModuleRepository } from '../InMemoryModuleRepository';

let uuidCounter = 0;
vi.mock('ecoforms-core', () => ({
    uuidv7: () => `mock-module-${++uuidCounter}`,
}));

describe('Module Use Cases', () => {
    const createRepo = () => new InMemoryModuleRepository();

    it('CreateModuleUseCase should create a module with uuidv7 and config_version=1', async () => {
        const repo = createRepo();
        const uc = new CreateModuleUseCase(repo);
        const id = await uc.execute({
            slug: 'fiscalizacao',
            name: 'Fiscalização Ambiental',
            entity_type: 'fiscalizacao',
        });

        expect(id).toBe('mock-module-1');

        const mod = await repo.findById(id);
        expect(mod).not.toBeNull();
        expect(mod!.slug).toBe('fiscalizacao');
        expect(mod!.status).toBe('draft');
        expect(mod!.config_version).toBe(1);
    });

    it('PublishModuleUseCase should publish a module without changing config_version', async () => {
        const repo = createRepo();
        const create = new CreateModuleUseCase(repo);
        const id = await create.execute({ slug: 'test', name: 'Test', entity_type: 'test' });

        const publish = new PublishModuleUseCase(repo);
        await publish.execute(id);

        const mod = await repo.findById(id);
        expect(mod!.status).toBe('published');
        expect(mod!.version).toBe(2);
        expect(mod!.config_version).toBe(1);
    });

    it('UpdateModuleConfigUseCase increments config_version for config and metadata edits', async () => {
        const repo = createRepo();
        const create = new CreateModuleUseCase(repo);
        const id = await create.execute({ slug: 'upd', name: 'Update', entity_type: 'upd' });

        const update = new UpdateModuleConfigUseCase(repo);
        await update.execute({
            id,
            name: 'Update Renamed',
            config: { forms: [{ form_id: 'form-1', required: true, default: false, order: 1 }] },
        });

        const mod = await repo.findById(id);
        expect(mod!.name).toBe('Update Renamed');
        expect(mod!.config.forms?.[0].form_id).toBe('form-1');
        expect(mod!.config_version).toBe(2);
    });

    it('ListModulesUseCase should filter by status', async () => {
        const repo = createRepo();
        const create = new CreateModuleUseCase(repo);
        await create.execute({ slug: 'a', name: 'A', entity_type: 'a' });
        const id2 = await create.execute({ slug: 'b', name: 'B', entity_type: 'b' });

        const publish = new PublishModuleUseCase(repo);
        await publish.execute(id2);

        const list = new ListModulesUseCase(repo);
        const all = await list.execute();
        expect(all.length).toBe(2);

        const published = await list.execute('published');
        expect(published.length).toBe(1);
        expect(published[0].slug).toBe('b');
    });

    it('GetModuleRuntimeUseCase should load runtime DTO', async () => {
        const repo = createRepo();
        const create = new CreateModuleUseCase(repo);
        const id = await create.execute({ slug: 'test', name: 'Test', entity_type: 'test' });

        repo.seedPermissions(id, [
            { profile: 'admin', can_view: true, can_create: true, can_edit: true, can_approve: true, can_delete: true },
        ]);

        const getRuntime = new GetModuleRuntimeUseCase(repo);
        const dto = await getRuntime.execute('test', 'admin');

        expect(dto).not.toBeNull();
        expect(dto!.slug).toBe('test');
        expect(dto!.permissions.can_view).toBe(true);
        expect(dto!.permissions.can_create).toBe(true);
    });
});