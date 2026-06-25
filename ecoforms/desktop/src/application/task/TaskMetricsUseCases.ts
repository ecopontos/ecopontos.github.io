import type {
    TaskMetricsRepository,
    TaskMetricsSummary,
    MetricsByUser,
    MetricsByPriority,
    DailyMetrics,
} from '../../domain/task/TaskMetricsRepository';

export class GetTaskMetricsSummaryUseCase {
    constructor(private readonly repo: TaskMetricsRepository) {}
    async execute(daysBack?: number): Promise<TaskMetricsSummary> {
        return this.repo.getSummary(daysBack);
    }
}

export class GetTaskMetricsByUserUseCase {
    constructor(private readonly repo: TaskMetricsRepository) {}
    async execute(daysBack?: number): Promise<MetricsByUser[]> {
        return this.repo.getByUser(daysBack);
    }
}

export class GetTaskMetricsByPriorityUseCase {
    constructor(private readonly repo: TaskMetricsRepository) {}
    async execute(daysBack?: number): Promise<MetricsByPriority[]> {
        return this.repo.getByPriority(daysBack);
    }
}

export class GetTaskMetricsDailyTrendsUseCase {
    constructor(private readonly repo: TaskMetricsRepository) {}
    async execute(daysBack: number): Promise<DailyMetrics[]> {
        return this.repo.getDailyTrends(daysBack);
    }
}
