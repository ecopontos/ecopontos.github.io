import { describe, it, expect } from 'vitest';
import { CreateModuleUseCase } from '../../../application/module/CreateModuleUseCase';
import { PublishModuleUseCase } from '../../../application/module/PublishModuleUseCase';
import { ListModulesUseCase } from '../../../application/module/ListModulesUseCase';
import { GetModuleRuntimeUseCase } from '../../../application/module/GetModuleRuntimeUseCase';
import { InMemoryModuleRepository } from '../InMemoryModuleRepository';

describe('Module Use Cases', () => {
    const createRepo = () => new InMemoryModuleRepository();

    it('CreateModuleUseCase should create a module', async () => {
        const repo = createRepo();
        const uc = new CreateModuleUseCase(repo);
        const id = await uc.execute({
            slug: 'fiscalizacao',
            name: 'Fiscalização Ambiental',
            entity_type: 'fiscalizacao',
        });
        expect(id).toBeDefined();

        const mod = await repo.findById(id);
        expect(mod).not.toBeNull();
        expect(mod!.slug).toBe('fiscalizacao');
        expect(mod!.status).toBe('draft');
    });

    it('PublishModuleUseCase should publish a module', async () => {
        const repo = createRepo();
        const create = new CreateModuleUseCase(repo);
        const id = await create.execute({ slug: 'test', name: 'Test', entity_type: 'test' });

        const publish = new PublishModuleUseCase(repo);
        await publish.execute(id);

        const mod = await repo.findById(id);
        expect(mod!.status).toBe('published');
        expect(mod!.version).toBe(2);
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
