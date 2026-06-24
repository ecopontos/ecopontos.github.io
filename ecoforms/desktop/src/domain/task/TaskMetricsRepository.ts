export interface TaskMetricsSummary {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    overdue: number;
    completedToday: number;
    completedThisWeek: number;
    completedThisMonth: number;
}

export interface MetricsByUser {
    userId: string;
    userName: string;
    completed: number;
    inProgress: number;
    pending: number;
}

export interface MetricsByPriority {
    priority: string;
    count: number;
    completedCount: number;
}

export interface DailyMetrics {
    date: string;
    completed: number;
}

export interface TaskMetricsRepository {
    getSummary(daysBack?: number): Promise<TaskMetricsSummary>;
    getByUser(daysBack?: number): Promise<MetricsByUser[]>;
    getByPriority(daysBack?: number): Promise<MetricsByPriority[]>;
    getDailyTrends(daysBack: number): Promise<DailyMetrics[]>;
}
