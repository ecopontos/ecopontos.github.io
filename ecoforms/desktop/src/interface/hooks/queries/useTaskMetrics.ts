'use client';

import { useState, useEffect } from 'react';
import { getContainerAsync } from '../utils/useContainer';

interface TaskMetrics {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    overdue: number;
    completedToday: number;
    completedThisWeek: number;
    completedThisMonth: number;
}

interface MetricsByUser {
    userId: string;
    userName: string;
    completed: number;
    inProgress: number;
    pending: number;
}

interface MetricsByPriority {
    priority: string;
    count: number;
    completedCount: number;
}

interface DailyMetrics {
    date: string;
    completed: number;
}

export interface TaskMetricsData {
    summary: TaskMetrics;
    byUser: MetricsByUser[];
    byPriority: MetricsByPriority[];
    dailyTrends: DailyMetrics[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useTaskMetrics(daysBack: number = 30): TaskMetricsData {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<TaskMetrics>({
        total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0,
        completedToday: 0, completedThisWeek: 0, completedThisMonth: 0,
    });
    const [byUser, setByUser] = useState<MetricsByUser[]>([]);
    const [byPriority, setByPriority] = useState<MetricsByPriority[]>([]);
    const [dailyTrends, setDailyTrends] = useState<DailyMetrics[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = () => setRefreshKey(prev => prev + 1);

    useEffect(() => {
        const loadMetrics = async () => {
            setLoading(true);
            setError(null);

            try {
                const container = await getContainerAsync();
                const summaryResult = await container.tasks.metricsSummary.execute(daysBack);
                setSummary(summaryResult);

                const byUserResult = await container.tasks.metricsByUser.execute(daysBack);
                setByUser(byUserResult);

                const byPriorityResult = await container.tasks.metricsByPriority.execute(daysBack);
                setByPriority(byPriorityResult);

                const dailyResult = await container.tasks.metricsDailyTrends.execute(daysBack);
                setDailyTrends(dailyResult);
            } catch (err) {
                console.error('Error loading task metrics:', err);
                setError(err instanceof Error ? err.message : 'Erro ao carregar métricas');
            } finally {
                setLoading(false);
            }
        };

        loadMetrics();
    }, [daysBack, refreshKey]);

    return { summary, byUser, byPriority, dailyTrends, loading, error, refresh };
}
