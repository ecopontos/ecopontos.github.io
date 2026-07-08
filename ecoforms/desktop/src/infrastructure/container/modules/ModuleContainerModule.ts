import { SqliteModuleRepository } from '../../persistence/sqlite/SqliteModuleRepository';
import { SqliteModuleVisualViewRepository } from '../../persistence/sqlite/SqliteModuleVisualViewRepository';
import { SqliteViewRegistryRepository } from '../../persistence/sqlite/SqliteViewRegistryRepository';
import { SqliteDecisionRegistryRepository } from '../../persistence/sqlite/SqliteDecisionRegistryRepository';
import { VisualQueryCache } from '../../../application/visuals/VisualQueryCache';
import { CreateModuleUseCase } from '../../../application/module/CreateModuleUseCase';
import { PublishModuleUseCase } from '../../../application/module/PublishModuleUseCase';
import { ArchiveModuleUseCase } from '../../../application/module/ArchiveModuleUseCase';
import { ListModulesUseCase } from '../../../application/module/ListModulesUseCase';
import { GetModuleRuntimeUseCase } from '../../../application/module/GetModuleRuntimeUseCase';
import { UpdateModuleConfigUseCase } from '../../../application/module/UpdateModuleConfigUseCase';
import { GetModuleVisuaisUseCase } from '../../../application/visuals/GetModuleVisuaisUseCase';
import {
    CreateViewUseCase,
    UpdateViewUseCase,
    DeleteViewUseCase,
    SetDefaultViewUseCase,
    CopyViewToPersonalUseCase,
    SyncPersonalViewUseCase,
} from '../../../application/visuals/VisualViewUseCases';
import {
    GetViewUseCase,
    GetActiveViewsUseCase,
    GetViewsByModuleUseCase,
    GetViewsByPerfilUseCase,
    CreateModuleDashboardUseCase,
    UpdateModuleDashboardUseCase,
    DeleteModuleDashboardUseCase,
    UpdateModuleDashboardWidgetsUseCase,
    GetModuleDashboardDataUseCase,
} from '../../../application/views/ViewUseCases';
import { GetDecisionUseCase, GetDecisionsByTargetTypeUseCase, GetDecisionsByActionUseCase, GetDecisionsForPerfilUseCase, GetActiveDecisionsUseCase } from '../../../application/decisions/DecisionUseCases';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

export interface ModuleContainerDependencies {
    sqlite: SqlitePort;
}

export interface ModuleContainerResult {
    moduleRepository: InstanceType<typeof SqliteModuleRepository>;
    moduleVisualViewRepository: InstanceType<typeof SqliteModuleVisualViewRepository>;
    viewRegistryRepository: InstanceType<typeof SqliteViewRegistryRepository>;
    decisionRegistryRepository: InstanceType<typeof SqliteDecisionRegistryRepository>;
    modules: {
        create: CreateModuleUseCase;
        publish: PublishModuleUseCase;
        archive: ArchiveModuleUseCase;
        list: ListModulesUseCase;
        getRuntime: GetModuleRuntimeUseCase;
        updateConfig: UpdateModuleConfigUseCase;
    };
    visuals: {
        getModuleVisuais: GetModuleVisuaisUseCase;
        createView: CreateViewUseCase;
        updateView: UpdateViewUseCase;
        deleteView: DeleteViewUseCase;
        setDefaultView: SetDefaultViewUseCase;
        copyViewToPersonal: CopyViewToPersonalUseCase;
        syncPersonalView: SyncPersonalViewUseCase;
    };
    views: {
        get: GetViewUseCase;
        getActive: GetActiveViewsUseCase;
        getByModule: GetViewsByModuleUseCase;
        getByPerfil: GetViewsByPerfilUseCase;
        createModuleDashboard: CreateModuleDashboardUseCase;
        updateModuleDashboard: UpdateModuleDashboardUseCase;
        deleteModuleDashboard: DeleteModuleDashboardUseCase;
        updateModuleDashboardWidgets: UpdateModuleDashboardWidgetsUseCase;
        getModuleDashboardData: GetModuleDashboardDataUseCase;
    };
    decisions: {
        get: GetDecisionUseCase;
        getByTargetType: GetDecisionsByTargetTypeUseCase;
        getByAction: GetDecisionsByActionUseCase;
        getForPerfil: GetDecisionsForPerfilUseCase;
        getActive: GetActiveDecisionsUseCase;
    };
}

export function buildModuleContainer(deps: ModuleContainerDependencies): ModuleContainerResult {
    const { sqlite } = deps;

    const moduleRepository = new SqliteModuleRepository(sqlite);
    const moduleVisualViewRepository = new SqliteModuleVisualViewRepository(sqlite);
    const viewRegistryRepository = new SqliteViewRegistryRepository(sqlite);
    const decisionRegistryRepository = new SqliteDecisionRegistryRepository(sqlite);
    const visualQueryCache = new VisualQueryCache();

    const modules = {
        create: new CreateModuleUseCase(moduleRepository),
        publish: new PublishModuleUseCase(moduleRepository),
        archive: new ArchiveModuleUseCase(moduleRepository),
        list: new ListModulesUseCase(moduleRepository),
        getRuntime: new GetModuleRuntimeUseCase(moduleRepository),
        updateConfig: new UpdateModuleConfigUseCase(moduleRepository),
    };

    const visuals = {
        getModuleVisuais: new GetModuleVisuaisUseCase(sqlite, moduleVisualViewRepository, visualQueryCache),
        createView: new CreateViewUseCase(moduleVisualViewRepository),
        updateView: new UpdateViewUseCase(moduleVisualViewRepository),
        deleteView: new DeleteViewUseCase(moduleVisualViewRepository),
        setDefaultView: new SetDefaultViewUseCase(moduleVisualViewRepository),
        copyViewToPersonal: new CopyViewToPersonalUseCase(moduleVisualViewRepository),
        syncPersonalView: new SyncPersonalViewUseCase(moduleVisualViewRepository),
    };

    const views = {
        get: new GetViewUseCase(viewRegistryRepository),
        getActive: new GetActiveViewsUseCase(viewRegistryRepository),
        getByModule: new GetViewsByModuleUseCase(viewRegistryRepository),
        getByPerfil: new GetViewsByPerfilUseCase(viewRegistryRepository),
        createModuleDashboard: new CreateModuleDashboardUseCase(viewRegistryRepository),
        updateModuleDashboard: new UpdateModuleDashboardUseCase(viewRegistryRepository),
        deleteModuleDashboard: new DeleteModuleDashboardUseCase(viewRegistryRepository),
        updateModuleDashboardWidgets: new UpdateModuleDashboardWidgetsUseCase(viewRegistryRepository),
        getModuleDashboardData: new GetModuleDashboardDataUseCase(sqlite, viewRegistryRepository),
    };

    const decisions = {
        get: new GetDecisionUseCase(decisionRegistryRepository),
        getByTargetType: new GetDecisionsByTargetTypeUseCase(decisionRegistryRepository),
        getByAction: new GetDecisionsByActionUseCase(decisionRegistryRepository),
        getForPerfil: new GetDecisionsForPerfilUseCase(decisionRegistryRepository),
        getActive: new GetActiveDecisionsUseCase(decisionRegistryRepository),
    };

    return {
        moduleRepository,
        moduleVisualViewRepository,
        viewRegistryRepository,
        decisionRegistryRepository,
        modules,
        visuals,
        views,
        decisions,
    };
}