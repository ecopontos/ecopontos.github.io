'use client';

import { useState } from 'react';
import { useTaskMetrics } from '@/src/interface/hooks/catalog/kanban';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RefreshCw, TrendingUp, Clock, CheckCircle, AlertTriangle, Users, BarChart3 } from 'lucide-react';

export function TaskMetricsContent() {
    const [daysBack, setDaysBack] = useState(30);
    const { summary, byUser, byPriority, dailyTrends, loading, error, refresh } = useTaskMetrics(daysBack);

    const formatPriority = (priority: string) => {
        const map: Record<string, { label: string; color: string }> = {
            'alta': { label: 'Alta', color: 'bg-red-500' },
            'media': { label: 'Média', color: 'bg-yellow-500' },
            'baixa': { label: 'Baixa', color: 'bg-green-500' },
            'sem_prioridade': { label: 'Sem Prioridade', color: 'bg-gray-400' },
        };
        return map[priority] || { label: priority, color: 'bg-gray-400' };
    };

    const completionRate = summary.total > 0
        ? Math.round((summary.completed / summary.total) * 100)
        : 0;

    // ADR-044 gap 2: respeitar o período selecionado (com teto visual de 30 barras)
    const maxBars = daysBack <= 14 ? daysBack : 30;
    const recentTrends = dailyTrends.slice(-maxBars);
    const maxCompleted = Math.max(...recentTrends.map(d => d.completed), 1);

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-3 items-center">
                <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Últimos 7 dias</SelectItem>
                        <SelectItem value="14">Últimos 14 dias</SelectItem>
                        <SelectItem value="30">Últimos 30 dias</SelectItem>
                        <SelectItem value="90">Últimos 90 dias</SelectItem>
                    </SelectContent>
                </Select>
                <Button onClick={refresh} variant="outline" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {error && (
                <Card className="border-red-500 bg-red-50">
                    <CardContent className="p-4 text-red-700">
                        {error}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Total de Tarefas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{summary.total}</div>
                        <p className="text-xs text-muted-foreground">
                            Taxa de conclusão: {completionRate}%
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Concluídas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{summary.completed}</div>
                        <div className="text-xs text-muted-foreground space-x-2">
                            <span>Hoje: {summary.completedToday}</span>
                            <span>•</span>
                            <span>Semana: {summary.completedThisWeek}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-yellow-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            Em Progresso
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-yellow-600">{summary.inProgress}</div>
                        <p className="text-xs text-muted-foreground">
                            Pendentes: {summary.pending}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Atrasadas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">{summary.overdue}</div>
                        <p className="text-xs text-muted-foreground">
                            Prazo vencido
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Tendência (últimos {maxBars} dias)
                        </CardTitle>
                        <CardDescription>Tarefas concluídas por dia</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-1 h-32">
                            {recentTrends.map((day) => {
                                const height = (day.completed / maxCompleted) * 100;
                                const dayName = new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' });
                                return (
                                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                            className="w-full bg-green-500 rounded-t transition-all"
                                            style={{ height: `${Math.max(height, 4)}%` }}
                                            title={`${day.completed} concluídas`}
                                        />
                                        <span className="text-xs text-muted-foreground">{dayName}</span>
                                        <span className="text-xs font-medium">{day.completed}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Por Prioridade</CardTitle>
                        <CardDescription>Distribuição de tarefas por prioridade</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {byPriority.map((item) => {
                                const prio = formatPriority(item.priority);
                                const completionPct = item.count > 0 ? Math.round((item.completedCount / item.count) * 100) : 0;
                                return (
                                    <div key={item.priority} className="flex items-center gap-3">
                                        <Badge className={`${prio.color} text-white w-24 justify-center`}>
                                            {prio.label}
                                        </Badge>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>{item.count} tarefas</span>
                                                <span className="text-muted-foreground">{completionPct}% concluídas</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`${prio.color} h-2 rounded-full transition-all`}
                                                    style={{ width: `${completionPct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Produtividade por Usuário
                    </CardTitle>
                    <CardDescription>Top 20 usuários por tarefas concluídas</CardDescription>
                </CardHeader>
                <CardContent>
                    {byUser.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            Nenhuma tarefa atribuída encontrada
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuário</TableHead>
                                    <TableHead className="text-center">Concluídas</TableHead>
                                    <TableHead className="text-center">Em Progresso</TableHead>
                                    <TableHead className="text-center">Pendentes</TableHead>
                                    <TableHead className="text-center">Total</TableHead>
                                    <TableHead className="text-right">Taxa de Conclusão</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {byUser.map((u) => {
                                    const total = u.completed + u.inProgress + u.pending;
                                    const rate = total > 0 ? Math.round((u.completed / total) * 100) : 0;
                                    return (
                                        <TableRow key={u.userId}>
                                            <TableCell className="font-medium">{u.userName}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="default" className="bg-green-500">
                                                    {u.completed}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{u.inProgress}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline">{u.pending}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">{total}</TableCell>
                                            <TableCell className="text-right">
                                                <span className={rate >= 70 ? 'text-green-600' : rate >= 40 ? 'text-yellow-600' : 'text-red-600'}>
                                                    {rate}%
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
