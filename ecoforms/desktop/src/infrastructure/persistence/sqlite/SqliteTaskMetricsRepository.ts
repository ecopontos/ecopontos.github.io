import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type {
    TaskMetricsRepository,
    TaskMetricsSummary,
    MetricsByUser,
    MetricsByPriority,
    DailyMetrics,
} from '../../../domain/task/TaskMetricsRepository';

export type { TaskMetricsRepository, TaskMetricsSummary, MetricsByUser, MetricsByPriority, DailyMetrics };

export class SqliteTaskMetricsRepository implements TaskMetricsRepository {
    constructor(private readonly db: SqlitePort) {}

    /**
     * Fragmento SQL ` AND date(<col>) >= date('now', '-N days')` para escopar por período.
     * Retorna '' quando daysBack é undefined (sem filtro). O número é saneado para inteiro
     * em [1, 3650], portanto a interpolação direta na string é segura contra injeção.
     */
    private periodClause(daysBack: number | undefined, col: string): string {
        if (daysBack === undefined || daysBack === null) return '';
        const safeDays = Math.min(3650, Math.max(1, Math.floor(Number(daysBack))));
        return ` AND date(${col}) >= date('now', '-${safeDays} days')`;
    }

    async getSummary(daysBack?: number): Promise<TaskMetricsSummary> {
        const period = this.periodClause(daysBack, 'criado_em');
        const rows = await this.db.query<{
            total: number;
            completed: number;
            in_progress: number;
            pending: number;
            overdue: number;
            completed_today: number;
            completed_week: number;
            completed_month: number;
        }>(
            `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'concluido'${period} THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'em_progresso'${period} THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'a_fazer'${period} THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status != 'concluido' AND prazo IS NOT NULL AND date(prazo) < date('now')${period} THEN 1 ELSE 0 END) as overdue,
                SUM(CASE WHEN status = 'concluido' AND date(updated_at) = date('now') THEN 1 ELSE 0 END) as completed_today,
                SUM(CASE WHEN status = 'concluido' AND date(updated_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as completed_week,
                SUM(CASE WHEN status = 'concluido' AND date(updated_at) >= date('now', '-30 days') THEN 1 ELSE 0 END) as completed_month
            FROM tarefas
            WHERE arquivado != 1 OR arquivado IS NULL`,
        );
        const r = rows[0];
        return {
            total: r.total || 0,
            completed: r.completed || 0,
            inProgress: r.in_progress || 0,
            pending: r.pending || 0,
            overdue: r.overdue || 0,
            completedToday: r.completed_today || 0,
            completedThisWeek: r.completed_week || 0,
            completedThisMonth: r.completed_month || 0,
        };
    }

    async getByUser(daysBack?: number): Promise<MetricsByUser[]> {
        const period = this.periodClause(daysBack, 't.criado_em');
        const rows = await this.db.query<{
            user_id: string;
            user_name: string;
            completed: number;
            in_progress: number;
            pending: number;
        }>(
            `SELECT
                atribuido_para as user_id,
                COALESCE(u.nome, atribuido_para) as user_name,
                SUM(CASE WHEN t.status = 'concluido' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN t.status = 'em_progresso' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN t.status = 'a_fazer' THEN 1 ELSE 0 END) as pending
            FROM tarefas t
            LEFT JOIN usuarios u ON t.atribuido_para = u.id
            WHERE (t.arquivado != 1 OR t.arquivado IS NULL)
                AND t.atribuido_para IS NOT NULL${period}
            GROUP BY t.atribuido_para
            ORDER BY completed DESC
            LIMIT 20`,
        );
        return rows.map(r => ({
            userId: r.user_id || '',
            userName: r.user_name || r.user_id || 'Desconhecido',
            completed: r.completed || 0,
            inProgress: r.in_progress || 0,
            pending: r.pending || 0,
        }));
    }

    async getByPriority(daysBack?: number): Promise<MetricsByPriority[]> {
        const period = this.periodClause(daysBack, 'criado_em');
        const rows = await this.db.query<{
            priority: string;
            count: number;
            completed_count: number;
        }>(
            `SELECT
                COALESCE(prioridade, 'sem_prioridade') as priority,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as completed_count
            FROM tarefas
            WHERE (arquivado != 1 OR arquivado IS NULL)${period}
            GROUP BY prioridade
            ORDER BY
                CASE prioridade
                    WHEN 'alta' THEN 1
                    WHEN 'media' THEN 2
                    WHEN 'baixa' THEN 3
                    ELSE 4
                END`,
        );
        return rows.map(r => ({
            priority: r.priority || 'sem_prioridade',
            count: r.count || 0,
            completedCount: r.completed_count || 0,
        }));
    }

    async getDailyTrends(daysBack: number): Promise<DailyMetrics[]> {
        const safeDays = Math.max(1, Math.floor(Number(daysBack)));
        if (safeDays > 3650) throw new Error('daysBack must be <= 10 years');
        const rows = await this.db.query<{
            date: string;
            completed: number;
        }>(
            `SELECT
                date(updated_at) as date,
                SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as completed
            FROM tarefas
            WHERE date(updated_at) >= date('now', ? || ' days')
            GROUP BY date(updated_at)
            ORDER BY date ASC`,
            [`-${safeDays}`],
        );
        return rows.map(r => ({
            date: r.date || '',
            completed: r.completed || 0,
        }));
    }
}
