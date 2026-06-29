import { CreateBookingUseCase } from '../application/service/CreateBookingUseCase';
import { ConfirmarAgendamentoUseCase } from '../application/service/ConfirmarAgendamentoUseCase';
import { CancelarAgendamentoUseCase } from '../application/service/CancelarAgendamentoUseCase';
import { GetAgendamentoUseCase } from '../application/service/GetAgendamentoUseCase';
import { ListAgendamentosUseCase } from '../application/service/ListAgendamentosUseCase';
import { EliminacaoTitularUseCase } from '../application/usuario/EliminacaoTitularUseCase';
import { ExportacaoDadosTitularUseCase } from '../application/usuario/ExportacaoDadosTitularUseCase';
import { CreateServiceSlotUseCase } from '../application/service/CreateServiceSlotUseCase';
import { UpdateServiceSlotUseCase } from '../application/service/UpdateServiceSlotUseCase';
import { PublishServiceSlotUseCase } from '../application/service/PublishServiceSlotUseCase';
import { CancelServiceSlotUseCase } from '../application/service/CancelServiceSlotUseCase';
import { EncerrarServiceSlotUseCase } from '../application/service/EncerrarServiceSlotUseCase';
import { ListServiceTypesUseCase } from '../application/service/ListServiceTypesUseCase';
import { CreateServiceTypeUseCase } from '../application/service/CreateServiceTypeUseCase';
import { UpdateServiceTypeUseCase } from '../application/service/UpdateServiceTypeUseCase';
import { NotificacaoService } from '../application/service/services/NotificacaoService';
import { AgendamentoEfeitosService } from '../application/service/services/AgendamentoEfeitosService';
import { DemandaTaskSynchronizer } from '../application/demanda/services/DemandaTaskSynchronizer';
import { getEffectiveSectors } from './persistence/SectorQueryUtils';
import { SyncOutbox } from './sync/SyncOutbox';
import { SqliteServiceTypeRepository } from './persistence/sqlite/SqliteServiceTypeRepository';
import { SqliteServiceSlotRepository } from './persistence/sqlite/SqliteServiceSlotRepository';
import { SqliteAgendamentoRepository } from './persistence/sqlite/SqliteAgendamentoRepository';
import { SqliteAgendamentoNotificacaoRepository } from './persistence/sqlite/SqliteAgendamentoNotificacaoRepository';
import { SqliteEcopontoRepository } from './persistence/sqlite/SqliteEcopontoRepository';
import { TaskProjectionService } from '../application/task/TaskProjectionService';
import { ArchiveTaskUseCase } from '../application/task/ArchiveTaskUseCase';
import { AssignTaskUseCase } from '../application/task/AssignTaskUseCase';
import { CreateTaskUseCase } from '../application/task/CreateTaskUseCase';
import { DeleteTaskUseCase } from '../application/task/DeleteTaskUseCase';
import { UnarchiveTaskUseCase } from '../application/task/UnarchiveTaskUseCase';
import { ListTasksByProjectUseCase } from '../application/task/ListTasksByProjectUseCase';
import { MoveTaskUseCase } from '../application/task/MoveTaskUseCase';
import { AddTaskCommentUseCase, FindAssignedActiveFormsUseCase } from '../application/task/TaskCommentUseCases';
import {
    GetTaskMetricsSummaryUseCase,
    GetTaskMetricsByUserUseCase,
    GetTaskMetricsByPriorityUseCase,
    GetTaskMetricsDailyTrendsUseCase,
} from '../application/task/TaskMetricsUseCases';
import { EditSuiteUseCase } from '../application/suite/EditSuiteUseCase';
import { ListInboxUseCase } from '../application/suite/ListInboxUseCase';
import { ReviewSuiteUseCase } from '../application/suite/ReviewSuiteUseCase';
import { SubmitSuiteUseCase } from '../application/suite/SubmitSuiteUseCase';
import { UpdateSuiteStatusUseCase } from '../application/suite/UpdateSuiteStatusUseCase';
import { ResubmitSuiteUseCase } from '../application/suite/ResubmitSuiteUseCase';
import { GetFormDefinitionUseCase } from '../application/suite/GetFormDefinitionUseCase';
import {
    CreateUserUseCase,
    ListUsersUseCase,
    ToggleUserStatusUseCase,
    UpdateUserUseCase,
} from '../application/user/ListUsersUseCase';
import { ListByTypeUseCase } from '../application/data-registry/ListByTypeUseCase';
import {
    ListItemsUseCase,
    CreateDataRegistryUseCase,
    DeleteDataRegistryUseCase,
    SaveDataRegistryUseCase,
} from '../application/data-registry/ListItemsUseCase';
import {
    SubmitToRegistryUseCase,
    ResolveFormDataSourceTypesUseCase,
    FindFormsUsingRegistryTypeUseCase,
} from '../application/data-registry/SubmitToRegistryUseCase';
import { ListTypesUseCase } from '../application/data-registry/ListTypesUseCase';
import { AggregateByTypeUseCase } from '../application/data-registry/AggregateByTypeUseCase';
import { CountByTypeUseCase } from '../application/data-registry/CountByTypeUseCase';
import { BulkInsertDataRegistryUseCase } from '../application/data-registry/BulkInsertDataRegistryUseCase';
import { UpdateManifestacaoStatusUseCase } from '../application/ouvidoria/UpdateManifestacaoStatusUseCase';
import { SeedManifestacaoCatalogUseCase } from '../application/ouvidoria/SeedManifestacaoCatalogUseCase';
import { EnviarRespostaUseCase } from '../application/ouvidoria/EnviarRespostaUseCase';
// AD-014: Ouvidoria migrada para suite + data_registry — use cases removidos
import { CreateDemandaUseCase } from '../application/demanda/CreateDemandaUseCase';
import {
    ListProjectsWithMetricsUseCase,
    CreateProjectUseCase,
    UpdateProjectUseCase,
    ArchiveProjectUseCase,
    UnarchiveProjectUseCase,
} from '../application/project/ProjectUseCases';
import { AcceptDemandaUseCase } from '../application/demanda/AcceptDemandaUseCase';
import { CloseDemandaUseCase } from '../application/demanda/CloseDemandaUseCase';
import { GetDemandaStatusUseCase } from '../application/demanda/GetDemandaStatusUseCase';
import type { TaskRepository } from '../domain/task/TaskRepository';
import type { SuiteRepository } from '../domain/suite/SuiteRepository';
import type { UserRepository } from '../domain/user/UserRepository';
import type { DataRegistryRepository } from '../domain/data-registry/DataRegistryRepository';
import type { DemandaRepository } from '../domain/demanda/DemandaRepository';
import type { ProjectRepository } from '../domain/project/ProjectRepository';
import type { KanbanRepository } from '../domain/kanban/KanbanRepository';
import type { ModuleRepository } from '../domain/module/ModuleRepository';
import type { ViewRegistryRepository } from '../domain/view/ViewRegistryRepository';
import type { DecisionRegistryRepository } from '../domain/decision/DecisionRegistryRepository';
import type { ClockPort } from '../application/ports/ClockPort';
import type { FileStoragePort } from '../application/ports/FileStoragePort';
import type { LoggerPort } from '../application/ports/LoggerPort';
import type { SqlitePort } from '../application/ports/SqlitePort';
import type { SyncPort } from '../application/ports/SyncPort';
import { ConsoleLogger } from './adapters/ConsoleLogger';
import { SystemClock } from './adapters/SystemClock';
import { SupabaseAdminAdapter } from './adapters/SupabaseAdminAdapter';
import { SqliteTaskRepository } from './persistence/sqlite/SqliteTaskRepository';
import { SqliteSuiteRepository } from './persistence/sqlite/SqliteSuiteRepository';
import { SqliteClienteRepository } from './persistence/sqlite/SqliteClienteRepository';
import { SqliteUserRepository } from './persistence/sqlite/SqliteUserRepository';
import { UserSnapshotService } from './sync/UserSnapshotService';
import { LanFileStorage } from './storage/LanFileStorage';
import { LanDomainSyncService } from './sync/LanDomainSyncService';
import { setCreateTaskRemocao } from './sync/HandlerRegistry';
import { SqliteDataRegistryRepository } from './persistence/sqlite/SqliteDataRegistryRepository';
import { SqliteManifestacaoRepository } from './persistence/sqlite/SqliteManifestacaoRepository';
import { SqliteLogisticsRepository } from './persistence/sqlite/SqliteLogisticsRepository';
import { SqliteDemandaRepository } from './persistence/sqlite/SqliteDemandaRepository';
import { SqliteProjectRepository } from './persistence/sqlite/SqliteProjectRepository';
import { SqliteTaskMetricsRepository } from './persistence/sqlite/SqliteTaskMetricsRepository';
import { SqliteKanbanRepository } from './persistence/sqlite/SqliteKanbanRepository';
import { SqliteHierarquiaPerfilRepository } from './persistence/sqlite/SqliteHierarquiaPerfilRepository';
import { SqliteTipoPrazoRepository } from './persistence/sqlite/SqliteTipoPrazoRepository';
import { SqliteNotificacaoSolicitanteRepository } from './persistence/sqlite/SqliteNotificacaoSolicitanteRepository';
import { SqliteTipoResiduoRepository } from './persistence/sqlite/SqliteTipoResiduoRepository';
import { SqliteExecucaoClienteRepository } from './persistence/sqlite/SqliteExecucaoClienteRepository';
import { SqliteEmailConfigRepository } from './persistence/sqlite/SqliteEmailConfigRepository';
import { SqliteSetorRepository } from './persistence/sqlite/SqliteSetorRepository';
import { SqliteUserWidgetInstanceRepository } from './persistence/sqlite/SqliteUserWidgetInstanceRepository';
import type { UserWidgetInstanceRepository } from '../domain/widget/UserWidgetInstanceRepository';
import {
    AddWidgetToDashboardUseCase,
    UpdateWidgetUseCase,
    RemoveWidgetUseCase,
    ListUserWidgetsUseCase,
} from '../application/widgets/WidgetUseCases';
import { TauriSqliteAdapter } from './persistence/sqlite/tauriSqliteAdapter';
import { SupabaseFileStorage } from './storage/SupabaseFileStorage';
import { buildModuleContainer } from './container/modules/ModuleContainerModule';
import { GetViewUseCase, GetActiveViewsUseCase, GetViewsByModuleUseCase, GetViewsByPerfilUseCase } from '../application/views/ViewUseCases';
import { GetDecisionUseCase, GetDecisionsByTargetTypeUseCase, GetDecisionsByActionUseCase, GetDecisionsForPerfilUseCase, GetActiveDecisionsUseCase } from '../application/decisions/DecisionUseCases';
import { GetModuleVisuaisUseCase } from '../application/visuals/GetModuleVisuaisUseCase';
import {
    CreateViewUseCase,
    UpdateViewUseCase,
    DeleteViewUseCase,
    SetDefaultViewUseCase,
    CopyViewToPersonalUseCase,
    SyncPersonalViewUseCase,
} from '../application/visuals/VisualViewUseCases';
import { getTransport, LazySyncAdapter } from './sync/lazy-sync';
import type { TransportService } from './sync/TransportService';
import { LanPullService } from './sync/LanPullService';

export interface TaskUseCases {
    create: CreateTaskUseCase;
    move: MoveTaskUseCase;
    assign: AssignTaskUseCase;
    archive: ArchiveTaskUseCase;
    unarchive: UnarchiveTaskUseCase;
    delete: DeleteTaskUseCase;
    listByProject: ListTasksByProjectUseCase;
    addComment: AddTaskCommentUseCase;
    findAssignedActiveForms: FindAssignedActiveFormsUseCase;
    metricsSummary: GetTaskMetricsSummaryUseCase;
    metricsByUser: GetTaskMetricsByUserUseCase;
    metricsByPriority: GetTaskMetricsByPriorityUseCase;
    metricsDailyTrends: GetTaskMetricsDailyTrendsUseCase;
}

export interface SuiteUseCases {
    submit: SubmitSuiteUseCase;
    edit: EditSuiteUseCase;
    review: ReviewSuiteUseCase;
    listInbox: ListInboxUseCase;
    updateStatus: UpdateSuiteStatusUseCase;
    resubmit: ResubmitSuiteUseCase;
    getFormDefinition: GetFormDefinitionUseCase;
}

export interface UserUseCases {
    list: ListUsersUseCase;
    create: CreateUserUseCase;
    update: UpdateUserUseCase;
    toggleStatus: ToggleUserStatusUseCase;
}

export interface DataRegistryUseCases {
    listItems: ListItemsUseCase;
    listByType: ListByTypeUseCase;
    listTypes: ListTypesUseCase;
    create: CreateDataRegistryUseCase;
    save: SaveDataRegistryUseCase;
    delete: DeleteDataRegistryUseCase;
    aggregate: AggregateByTypeUseCase;
    countByType: CountByTypeUseCase;
    bulkInsert: BulkInsertDataRegistryUseCase;
    submitToRegistry: SubmitToRegistryUseCase;
    resolveFormDataSourceTypes: ResolveFormDataSourceTypesUseCase;
    findFormsUsingRegistryType: FindFormsUsingRegistryTypeUseCase;
}

export interface DemandaUseCases {
    create: CreateDemandaUseCase;
    accept: AcceptDemandaUseCase;
    close: CloseDemandaUseCase;
    getStatus: GetDemandaStatusUseCase;
}

export interface ModuleUseCases {
    create: import('../application/module/CreateModuleUseCase').CreateModuleUseCase;
    publish: import('../application/module/PublishModuleUseCase').PublishModuleUseCase;
    archive: import('../application/module/ArchiveModuleUseCase').ArchiveModuleUseCase;
    list: import('../application/module/ListModulesUseCase').ListModulesUseCase;
    getRuntime: import('../application/module/GetModuleRuntimeUseCase').GetModuleRuntimeUseCase;
    updateConfig: import('../application/module/UpdateModuleConfigUseCase').UpdateModuleConfigUseCase;
}

export interface ViewRegistryUseCases {
    get: GetViewUseCase;
    getActive: GetActiveViewsUseCase;
    getByModule: GetViewsByModuleUseCase;
    getByPerfil: GetViewsByPerfilUseCase;
}

export interface DecisionRegistryUseCases {
    get: GetDecisionUseCase;
    getByTargetType: GetDecisionsByTargetTypeUseCase;
    getByAction: GetDecisionsByActionUseCase;
    getForPerfil: GetDecisionsForPerfilUseCase;
    getActive: GetActiveDecisionsUseCase;
}

export interface VisualsUseCases {
    getModuleVisuais: GetModuleVisuaisUseCase;
    createView: CreateViewUseCase;
    updateView: UpdateViewUseCase;
    deleteView: DeleteViewUseCase;
    setDefaultView: SetDefaultViewUseCase;
    copyViewToPersonal: CopyViewToPersonalUseCase;
    syncPersonalView: SyncPersonalViewUseCase;
}

export interface WidgetUseCases {
    list: ListUserWidgetsUseCase;
    add: AddWidgetToDashboardUseCase;
    update: UpdateWidgetUseCase;
    remove: RemoveWidgetUseCase;
}

export interface ProjectUseCases {
    listWithMetrics: ListProjectsWithMetricsUseCase;
    create: CreateProjectUseCase;
    update: UpdateProjectUseCase;
    archive: ArchiveProjectUseCase;
    unarchive: UnarchiveProjectUseCase;
}

export interface Container {
    sqlite: SqlitePort;
    fileStorage: FileStoragePort;
    clock: ClockPort;
    logger: LoggerPort;
    sync: SyncPort;
    syncTransportService: TransportService | null;
    syncOutbox: SyncOutbox;
    taskRepository: TaskRepository;
    suiteRepository: SuiteRepository;
    clienteRepository: import('../domain/cliente/ClienteRepository').ClienteRepository;
    setorRepository: import('../domain/setor/SetorRepository').SetorRepository;
    ecopontoRepository: import('../domain/ecoponto/EcopontoRepository').EcopontoRepository;
    userRepository: UserRepository;
    dataRegistryRepository: DataRegistryRepository;
    manifestacaoRepository: import('../domain/ouvidoria/ManifestacaoRepository').ManifestacaoRepository;
    logisticsRepository: import('../domain/logistics/LogisticsRepository').LogisticsRepository;
    projectRepository: ProjectRepository;
    taskMetricsRepository: SqliteTaskMetricsRepository;
    demandaRepository: DemandaRepository;
    kanbanRepository: KanbanRepository;
    moduleRepository: ModuleRepository;
    moduleVisualViewRepository: import('../domain/visual/ModuleVisualViewRepository').ModuleVisualViewRepository;
    viewRegistryRepository: ViewRegistryRepository;
    decisionRegistryRepository: DecisionRegistryRepository;
    userWidgetInstanceRepository: UserWidgetInstanceRepository;
    tasks: TaskUseCases;
    suites: SuiteUseCases;
    users: UserUseCases;
    dataRegistry: DataRegistryUseCases;
    projects: ProjectUseCases;
    widgets: WidgetUseCases;
    demandas: DemandaUseCases;
    modules: ModuleUseCases;
    views: ViewRegistryUseCases;
    decisions: DecisionRegistryUseCases;
    visuals: VisualsUseCases;
    updateManifestacaoStatus: UpdateManifestacaoStatusUseCase;
    seedManifestacaoCatalog: SeedManifestacaoCatalogUseCase;
    enviarResposta: EnviarRespostaUseCase;
    // ADR-018 + ADR-019: Service Booking Engine
    serviceTypeRepo: import('../domain/service/ServiceTypeRepository').ServiceTypeRepository;
    serviceSlotRepo: import('../domain/service/ServiceSlotRepository').ServiceSlotRepository;
    agendamentoRepo: import('../domain/service/AgendamentoRepository').AgendamentoRepository;
    agendamentoNotificacaoRepo: import('../domain/service/AgendamentoNotificacaoRepository').AgendamentoNotificacaoRepository;
    createBookingUseCase: CreateBookingUseCase;
    confirmarAgendamentoUseCase: ConfirmarAgendamentoUseCase;
    cancelarAgendamentoUseCase: CancelarAgendamentoUseCase;
    getAgendamentoUseCase: GetAgendamentoUseCase;
    listAgendamentosUseCase: ListAgendamentosUseCase;
    createServiceSlotUseCase: CreateServiceSlotUseCase;
    updateServiceSlotUseCase: UpdateServiceSlotUseCase;
    publishServiceSlotUseCase: PublishServiceSlotUseCase;
    cancelServiceSlotUseCase: CancelServiceSlotUseCase;
    encerrarServiceSlotUseCase: EncerrarServiceSlotUseCase;
    listServiceTypesUseCase: ListServiceTypesUseCase;
    createServiceTypeUseCase: CreateServiceTypeUseCase;
    updateServiceTypeUseCase: UpdateServiceTypeUseCase;
    // ADR-021: LGPD
    eliminacaoTitularUseCase: EliminacaoTitularUseCase;
    exportacaoDadosTitularUseCase: ExportacaoDadosTitularUseCase;
    // ADR-026: camada de conversão canônica domínio → task
    taskProjection: TaskProjectionService;
    // LAN sync
    lanFileStorage: import('./storage/LanFileStorage').LanFileStorage;
    lanPullService: LanPullService;
    sqliteUserRepository: import('./persistence/sqlite/SqliteUserRepository').SqliteUserRepository;
    // Catálogos e configurações
    hierarquiaPerfilRepository: import('../domain/hierarquia-perfil/HierarquiaPerfilRepository').HierarquiaPerfilRepository;
    tipoPrazoRepository: import('../domain/tipo-prazo/TipoPrazoRepository').TipoPrazoRepository;
    notificacaoSolicitanteRepository: import('../domain/notificacao-solicitante/NotificacaoSolicitanteRepository').NotificacaoSolicitanteRepository;
    tipoResiduoRepository: import('../domain/tipo-residuo/TipoResiduoRepository').TipoResiduoRepository;
    execucaoClienteRepository: import('../domain/execucao-cliente/ExecucaoClienteRepository').ExecucaoClienteRepository;
    emailConfigRepository: import('../domain/email-config/EmailConfigRepository').EmailConfigRepository;
}

let _container: Container | null = null;
let _columnsEnsured = false;
let _columnsPromise: Promise<void> | null = null;
let _dbInitialized = false;
let _dbInitPromise: Promise<void> | null = null;

async function initDatabase(): Promise<void> {
    if (_dbInitialized) return;
    if (_dbInitPromise) return _dbInitPromise;

    _dbInitPromise = (async () => {
        try {
            const { appDataDir, join } = await import('@tauri-apps/api/path');
            const appData = await appDataDir();
            const dbPath = await join(appData, 'ecoforms.db');

            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('db_connect', { dbPath });

            _dbInitialized = true;
        } catch (e) {
            console.error('[Container] Failed to initialize database:', e);
            _dbInitPromise = null;
            throw e;
        }
    })();

    return _dbInitPromise;
}

async function ensureColumnsIfNeeded(sqlite: SqlitePort, lanFileStorage?: import('./storage/LanFileStorage').LanFileStorage): Promise<void> {
    if (_columnsEnsured) return;
    if (_columnsPromise) return _columnsPromise;

    _columnsPromise = (async () => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { migratePtBrIfNeeded } = await import('@/scripts/migrate-ptbr' as any);
            await migratePtBrIfNeeded(
                (sql: string, params?: unknown[]) => sqlite.query(sql, params, { bootstrap: true }),
                (sql: string, params?: unknown[]) => sqlite.execute(sql, params, { bootstrap: true }),
            );
        } catch (e) {
            console.warn('[Container] Migração pt_br skipped:', e);
        }

        let columnsMigrated = false;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { ensureColumns } = await import('@/scripts/ensure-columns.ts' as any);
            await ensureColumns(
                (sql: string, params?: unknown[]) => sqlite.query(sql, params, { bootstrap: true }),
                (sql: string, params?: unknown[]) => sqlite.execute(sql, params, { bootstrap: true }),
            );

            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('bootstrap_seed_rbac');
            columnsMigrated = true;
        } catch (e) {
            console.error('[Container] Column migration FAILED — will retry on next access:', e);
        }

        if (columnsMigrated) {
            // AD-020: Registrar resolvers de dataSource do CRM
            try {
                const { registerCrmDataSources } = await import('./config/crm-datasources');
                registerCrmDataSources(sqlite, lanFileStorage);
                console.log('[Container] CRM data sources registered');

                if (lanFileStorage) {
                    const { CrmSnapshotPublisher } = await import('./sync/CrmSnapshotPublisher');
                    const crmPublisher = new CrmSnapshotPublisher(lanFileStorage, sqlite);
                    crmPublisher.publishAll().catch(() => {});
                    console.log('[Container] CRM snapshot publisher started');
                }
            } catch (e) {
                console.warn('[Container] CRM data source registration skipped:', e);
            }
            // ADR-016: verifica prazos vencidos de manifestações ao boot (fire-and-forget)
            try {
                const { verificarPrazosVencidos } = await import('../application/ouvidoria/VerificarPrazosVencidosJob');
                verificarPrazosVencidos(sqlite).catch(() => {});
            } catch (e) {
                console.warn('[Container] VerificarPrazosVencidosJob skipped:', e);
            }

            _columnsEnsured = true;
        }
    })();

    return _columnsPromise;
}

export type ContainerBootstrapOptions = Record<string, unknown>;
// syncIndexFactory removed — not available in current codebase. Reservado
// para opções futuras de bootstrap do container DI.

function buildContainer(overrides: Partial<Container> = {}, _bootstrap: ContainerBootstrapOptions = {}): Container {
    const sqlite = overrides.sqlite ?? new TauriSqliteAdapter();
    const clock = overrides.clock ?? new SystemClock();
    const logger = overrides.logger ?? new ConsoleLogger();
    const fileStorage = overrides.fileStorage ?? new SupabaseFileStorage();

    const syncOutbox = new SyncOutbox();
    const sync = overrides.sync ?? new LazySyncAdapter(sqlite, fileStorage, clock);
    const syncTransportService = getTransport();

    const taskRepository = overrides.taskRepository ?? new SqliteTaskRepository(sqlite);
    const suiteRepository = overrides.suiteRepository ?? new SqliteSuiteRepository(sqlite);
    const lanFileStorage = new LanFileStorage(sqlite);
    const lanDomainSyncService = new LanDomainSyncService(lanFileStorage);
    const lanPullService = new LanPullService(lanDomainSyncService, sqlite);
    const userSnapshotService = new UserSnapshotService(sqlite, lanDomainSyncService, lanFileStorage);
    const sqliteUserRepository = new SqliteUserRepository(sqlite, () => {
        userSnapshotService.publishUserSnapshot();
    });
    const userRepository = overrides.userRepository ?? sqliteUserRepository;
    const dataRegistryRepository = overrides.dataRegistryRepository ?? new SqliteDataRegistryRepository(sqlite);
    const clienteRepository = overrides.clienteRepository ?? new SqliteClienteRepository(sqlite);
    const manifestacaoRepository = overrides.manifestacaoRepository ?? new SqliteManifestacaoRepository(sqlite, syncOutbox);
    const logisticsRepository = overrides.logisticsRepository ?? new SqliteLogisticsRepository(sqlite, syncOutbox);
    const projectRepository = overrides.projectRepository ?? new SqliteProjectRepository(sqlite);
    const taskMetricsRepository = overrides.taskMetricsRepository ?? new SqliteTaskMetricsRepository(sqlite);
    const demandaRepository = overrides.demandaRepository ?? new SqliteDemandaRepository(sqlite);
    const kanbanRepository = overrides.kanbanRepository ?? new SqliteKanbanRepository(sqlite);

    const demandaTaskSynchronizer = new DemandaTaskSynchronizer(taskRepository, demandaRepository);

    // ADR-026: camada de conversão canônica domínio → task
    const taskProjection = new TaskProjectionService(
        taskRepository,
        (tf) => demandaRepository.saveTarefaFormulario(tf),
        clock,
        syncOutbox,
    );

    const tasks: TaskUseCases = overrides.tasks ?? {
        create: new CreateTaskUseCase(taskRepository, clock, sqlite),
        move: new MoveTaskUseCase(taskRepository, demandaTaskSynchronizer, syncOutbox),
        assign: new AssignTaskUseCase(taskRepository),
        archive: new ArchiveTaskUseCase(taskRepository, demandaTaskSynchronizer, syncOutbox),
        unarchive: new UnarchiveTaskUseCase(taskRepository, syncOutbox),
        delete: new DeleteTaskUseCase(taskRepository, syncOutbox),
        listByProject: new ListTasksByProjectUseCase(taskRepository),
        addComment: new AddTaskCommentUseCase(taskRepository, syncOutbox),
        findAssignedActiveForms: new FindAssignedActiveFormsUseCase(taskRepository),
        metricsSummary: new GetTaskMetricsSummaryUseCase(taskMetricsRepository),
        metricsByUser: new GetTaskMetricsByUserUseCase(taskMetricsRepository),
        metricsByPriority: new GetTaskMetricsByPriorityUseCase(taskMetricsRepository),
        metricsDailyTrends: new GetTaskMetricsDailyTrendsUseCase(taskMetricsRepository),
    };

    try {
        setCreateTaskRemocao(async (input) => {
            const dto = await tasks.create.execute(input);
            return { id: dto.id };
        });
    } catch (e) {
        console.warn('[Container] Failed to wire remocao task creator:', e);
    }

    const suites: SuiteUseCases = overrides.suites ?? {
        submit: new SubmitSuiteUseCase(suiteRepository, clock),
        edit: new EditSuiteUseCase(suiteRepository, clock, syncOutbox),
        review: new ReviewSuiteUseCase(suiteRepository, clock, syncOutbox),
        listInbox: new ListInboxUseCase(suiteRepository),
        updateStatus: new UpdateSuiteStatusUseCase(suiteRepository, clock),
        resubmit: new ResubmitSuiteUseCase(suiteRepository, clock, syncOutbox),
        getFormDefinition: new GetFormDefinitionUseCase(sqlite),
    };

    const users: UserUseCases = overrides.users ?? {
        list: new ListUsersUseCase(userRepository),
        create: new CreateUserUseCase(userRepository),
        update: new UpdateUserUseCase(userRepository),
        toggleStatus: new ToggleUserStatusUseCase(userRepository),
    };

    const dataRegistry: DataRegistryUseCases = overrides.dataRegistry ?? {
        listItems: new ListItemsUseCase(dataRegistryRepository),
        listByType: new ListByTypeUseCase(dataRegistryRepository),
        listTypes: new ListTypesUseCase(dataRegistryRepository),
        create: new CreateDataRegistryUseCase(dataRegistryRepository, clock),
        save: new SaveDataRegistryUseCase(dataRegistryRepository, clock),
        delete: new DeleteDataRegistryUseCase(dataRegistryRepository),
        aggregate: new AggregateByTypeUseCase(dataRegistryRepository),
        countByType: new CountByTypeUseCase(dataRegistryRepository),
        bulkInsert: new BulkInsertDataRegistryUseCase(dataRegistryRepository, clock),
        submitToRegistry: new SubmitToRegistryUseCase(dataRegistryRepository, clock),
        resolveFormDataSourceTypes: new ResolveFormDataSourceTypesUseCase(sqlite),
        findFormsUsingRegistryType: new FindFormsUsingRegistryTypeUseCase(sqlite),
    };

    const userWidgetInstanceRepository = overrides.userWidgetInstanceRepository ?? new SqliteUserWidgetInstanceRepository(sqlite);
    const widgets: WidgetUseCases = overrides.widgets ?? {
        list: new ListUserWidgetsUseCase(userWidgetInstanceRepository),
        add: new AddWidgetToDashboardUseCase(userWidgetInstanceRepository),
        update: new UpdateWidgetUseCase(userWidgetInstanceRepository),
        remove: new RemoveWidgetUseCase(userWidgetInstanceRepository),
    };

    const projects: ProjectUseCases = overrides.projects ?? {
        listWithMetrics: new ListProjectsWithMetricsUseCase(projectRepository),
        create: new CreateProjectUseCase(projectRepository),
        update: new UpdateProjectUseCase(projectRepository),
        archive: new ArchiveProjectUseCase(projectRepository),
        unarchive: new UnarchiveProjectUseCase(projectRepository),
    };

    const demandas: DemandaUseCases = overrides.demandas ?? {
        create: new CreateDemandaUseCase(demandaRepository, clock, sqlite, getEffectiveSectors),
        accept: new AcceptDemandaUseCase(demandaRepository, taskProjection, clock, syncOutbox),
        close: new CloseDemandaUseCase(demandaRepository, clock, demandaTaskSynchronizer, syncOutbox),
        getStatus: new GetDemandaStatusUseCase(demandaRepository, taskRepository),
    };

    const moduleResult = buildModuleContainer({ sqlite });
    const {
        moduleRepository, moduleVisualViewRepository,
        viewRegistryRepository, decisionRegistryRepository,
        modules, visuals, views, decisions,
    } = moduleResult;

    const updateManifestacaoStatus = new UpdateManifestacaoStatusUseCase(manifestacaoRepository, syncOutbox, taskProjection);
    const seedManifestacaoCatalog = new SeedManifestacaoCatalogUseCase(sqlite);
    const enviarResposta = new EnviarRespostaUseCase(manifestacaoRepository, syncOutbox);

    // ADR-018 + ADR-019: Service Booking Engine
    const serviceTypeRepo = new SqliteServiceTypeRepository(sqlite);
    const serviceSlotRepo = new SqliteServiceSlotRepository(sqlite);
    const agendamentoRepo = new SqliteAgendamentoRepository(sqlite);
    const agendamentoNotificacaoRepo = new SqliteAgendamentoNotificacaoRepository(sqlite);
    const notificacaoService = new NotificacaoService(agendamentoNotificacaoRepo, serviceSlotRepo, serviceTypeRepo);
    const agendamentoEfeitos = new AgendamentoEfeitosService(taskProjection, agendamentoRepo, serviceSlotRepo, serviceTypeRepo, notificacaoService, syncOutbox);
    const createBookingUseCase = new CreateBookingUseCase(serviceSlotRepo, serviceTypeRepo, agendamentoRepo, agendamentoEfeitos);
    const confirmarAgendamentoUseCase = new ConfirmarAgendamentoUseCase(agendamentoRepo, agendamentoEfeitos);
    const cancelarAgendamentoUseCase = new CancelarAgendamentoUseCase(agendamentoRepo, serviceSlotRepo, agendamentoEfeitos);
    const getAgendamentoUseCase = new GetAgendamentoUseCase(agendamentoRepo);
    const listAgendamentosUseCase = new ListAgendamentosUseCase(agendamentoRepo);
    const createServiceSlotUseCase = new CreateServiceSlotUseCase(serviceSlotRepo, serviceTypeRepo);
    const updateServiceSlotUseCase = new UpdateServiceSlotUseCase(serviceSlotRepo);
    const publishServiceSlotUseCase = new PublishServiceSlotUseCase(serviceSlotRepo);
    const cancelServiceSlotUseCase = new CancelServiceSlotUseCase(serviceSlotRepo);
    const encerrarServiceSlotUseCase = new EncerrarServiceSlotUseCase(serviceSlotRepo);
    const listServiceTypesUseCase = new ListServiceTypesUseCase(serviceTypeRepo, sqlite);
    const createServiceTypeUseCase = new CreateServiceTypeUseCase(serviceTypeRepo, sqlite);
    const updateServiceTypeUseCase = new UpdateServiceTypeUseCase(serviceTypeRepo, sqlite);

    // ADR-021: LGPD
    const supabaseAdmin = new SupabaseAdminAdapter();
    const eliminacaoTitularUseCase = new EliminacaoTitularUseCase(sqlite, fileStorage, supabaseAdmin);
    const exportacaoDadosTitularUseCase = new ExportacaoDadosTitularUseCase(sqlite);

    // Catálogos e configurações
    const hierarquiaPerfilRepository = new SqliteHierarquiaPerfilRepository(sqlite);
    const tipoPrazoRepository = new SqliteTipoPrazoRepository(sqlite);
    const notificacaoSolicitanteRepository = new SqliteNotificacaoSolicitanteRepository(sqlite);
    const tipoResiduoRepository = new SqliteTipoResiduoRepository(sqlite);
    const execucaoClienteRepository = new SqliteExecucaoClienteRepository(sqlite);
    const emailConfigRepository = new SqliteEmailConfigRepository(sqlite);
    const setorRepository = new SqliteSetorRepository(sqlite);
    const ecopontoRepository = new SqliteEcopontoRepository(sqlite);

    return {
        sqlite, clock, logger, fileStorage, sync, syncTransportService, syncOutbox,
        taskRepository, suiteRepository, clienteRepository, userRepository,
        dataRegistryRepository, manifestacaoRepository, logisticsRepository,
        projectRepository, taskMetricsRepository, demandaRepository, kanbanRepository,
        moduleRepository, moduleVisualViewRepository,
        viewRegistryRepository, decisionRegistryRepository,
        userWidgetInstanceRepository,
        tasks, suites, users, dataRegistry, projects, widgets, demandas,
        modules, views, decisions, visuals,
        updateManifestacaoStatus,
        seedManifestacaoCatalog,
        enviarResposta,
        serviceTypeRepo, serviceSlotRepo, agendamentoRepo, agendamentoNotificacaoRepo,
        createBookingUseCase, confirmarAgendamentoUseCase, cancelarAgendamentoUseCase,
        getAgendamentoUseCase, listAgendamentosUseCase,
        createServiceSlotUseCase, updateServiceSlotUseCase,
        publishServiceSlotUseCase, cancelServiceSlotUseCase, encerrarServiceSlotUseCase,
        listServiceTypesUseCase, createServiceTypeUseCase, updateServiceTypeUseCase,
        eliminacaoTitularUseCase, exportacaoDadosTitularUseCase,
        taskProjection,
        lanFileStorage,
        lanPullService,
        sqliteUserRepository,
        hierarquiaPerfilRepository,
        ecopontoRepository,
        tipoPrazoRepository,
        notificacaoSolicitanteRepository,
        tipoResiduoRepository,
        execucaoClienteRepository,
        emailConfigRepository,
        setorRepository,
    };
}

export function getContainer(): Container {
    if (!_container) {
        _container = buildContainer();
    }
    return _container;
}

export async function getContainerAsync(): Promise<Container> {
    await initDatabase();
    if (!_container) {
        _container = buildContainer();
    }
    await ensureColumnsIfNeeded(_container.sqlite, _container.lanFileStorage);
    return _container;
}

/** Sobrescreve o container (útil em testes). */
export function setContainer(partial: Partial<Container>): void {
    _container = buildContainer({ ...getContainer(), ...partial });
}

export function resetContainer(): void {
    _container = null;
    _columnsEnsured = false;
    _columnsPromise = null;
    _dbInitialized = false;
    _dbInitPromise = null;
}
