'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/src/lib/utils';
import { Calendar, CalendarRange, Repeat } from 'lucide-react';

export type TipoPrazo = 'unico' | 'periodo' | 'recorrente';

export interface RecorrenciaConfig {
    frequencia: 'diaria' | 'semanal' | 'mensal' | 'anual';
    intervalo: number;
    dias_semana: number[];
    fim_recorrencia: string;
}

export const DEFAULT_RECORRENCIA: RecorrenciaConfig = {
    frequencia: 'semanal',
    intervalo: 1,
    dias_semana: [],
    fim_recorrencia: '',
};

function formatLocalDateTime(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatLocalDate(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface TaskDateSectionProps {
    tipoPrazo: TipoPrazo;
    onChangeTipoPrazo: (v: TipoPrazo) => void;
    prazo: string;
    onChangePrazo: (v: string) => void;
    prazoFim: string;
    onChangePrazoFim: (v: string) => void;
    recorrencia: RecorrenciaConfig;
    onChangeRecorrencia: (v: RecorrenciaConfig) => void;
    disabled?: boolean;
}

const DIAS_SEMANA = [
    { value: 0, short: 'D', full: 'Domingo' },
    { value: 1, short: 'S', full: 'Segunda' },
    { value: 2, short: 'T', full: 'Terça' },
    { value: 3, short: 'Q', full: 'Quarta' },
    { value: 4, short: 'Q', full: 'Quinta' },
    { value: 5, short: 'S', full: 'Sexta' },
    { value: 6, short: 'S', full: 'Sábado' },
];

const TIPO_OPTIONS: { value: TipoPrazo; Icon: React.ElementType; label: string }[] = [
    { value: 'unico', Icon: Calendar, label: 'Data única' },
    { value: 'periodo', Icon: CalendarRange, label: 'Período' },
    { value: 'recorrente', Icon: Repeat, label: 'Recorrente' },
];

export function TaskDateSection({
    tipoPrazo,
    onChangeTipoPrazo,
    prazo,
    onChangePrazo,
    prazoFim,
    onChangePrazoFim,
    recorrencia,
    onChangeRecorrencia,
    disabled,
}: TaskDateSectionProps) {
    const toggleDia = (dia: number) => {
        const dias = recorrencia.dias_semana ?? [];
        const novos = dias.includes(dia) ? dias.filter(d => d !== dia) : [...dias, dia];
        onChangeRecorrencia({ ...recorrencia, dias_semana: novos });
    };

    return (
        <div className="space-y-3">
            {/* Type selector */}
            <div>
                <Label className="mb-1.5 block text-sm">Tipo de Data</Label>
                <div className="flex gap-2 flex-wrap">
                    {TIPO_OPTIONS.map(({ value, Icon, label }) => (
                        <button
                            key={value}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChangeTipoPrazo(value)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors',
                                tipoPrazo === value
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                            )}
                        >
                            <Icon className="h-3 w-3" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Data única */}
            {tipoPrazo === 'unico' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onChangePrazo(formatLocalDateTime(new Date()))}
                            disabled={disabled}
                            className="text-xs h-7"
                        >
                            Hoje
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 1);
                                onChangePrazo(formatLocalDateTime(d));
                            }}
                            disabled={disabled}
                            className="text-xs h-7"
                        >
                            Amanhã
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 7);
                                onChangePrazo(formatLocalDateTime(d));
                            }}
                            disabled={disabled}
                            className="text-xs h-7"
                        >
                            +7 dias
                        </Button>
                    </div>
                    <Input
                        id="prazo-unico"
                        type="datetime-local"
                        value={prazo}
                        onChange={(e) => onChangePrazo(e.target.value)}
                        disabled={disabled}
                    />
                </div>
            )}

            {/* Período */}
            {tipoPrazo === 'periodo' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const now = new Date();
                                onChangePrazo(formatLocalDateTime(now));
                                const end = new Date(now);
                                end.setDate(end.getDate() + 1);
                                onChangePrazoFim(formatLocalDateTime(end));
                            }}
                            disabled={disabled}
                            className="text-xs h-7"
                        >
                            Hoje → Amanhã
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const now = new Date();
                                onChangePrazo(formatLocalDateTime(now));
                                const end = new Date(now);
                                end.setDate(end.getDate() + 7);
                                onChangePrazoFim(formatLocalDateTime(end));
                            }}
                            disabled={disabled}
                            className="text-xs h-7"
                        >
                            Hoje → +7 dias
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="prazo-inicio" className="mb-1.5 block text-sm">Início</Label>
                            <Input
                                id="prazo-inicio"
                                type="datetime-local"
                                value={prazo}
                                onChange={(e) => onChangePrazo(e.target.value)}
                                disabled={disabled}
                            />
                        </div>
                        <div>
                            <Label htmlFor="prazo-fim" className="mb-1.5 block text-sm">Fim</Label>
                            <Input
                                id="prazo-fim"
                                type="datetime-local"
                                value={prazoFim}
                                onChange={(e) => onChangePrazoFim(e.target.value)}
                                disabled={disabled}
                            />
                        </div>
                    </div>
                </div>
            )}

                    {/* Recorrente */}
            {tipoPrazo === 'recorrente' && (
                <div className="space-y-3">
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <Label htmlFor="prazo-recorrente-inicio" className="text-sm">
                                Primeira ocorrência
                            </Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onChangePrazo(formatLocalDate(new Date()))}
                                disabled={disabled}
                                className="text-xs h-6 px-2"
                            >
                                Hoje
                            </Button>
                        </div>
                        <Input
                            id="prazo-recorrente-inicio"
                            type="date"
                            value={prazo ? prazo.slice(0, 10) : ''}
                            onChange={(e) => {
                                const novaData = e.target.value;
                                if (!novaData) {
                                    onChangePrazo('');
                                    return;
                                }
                                const horaAtual = prazo && prazo.length > 10 ? prazo.slice(11) : '00:00';
                                onChangePrazo(`${novaData}T${horaAtual}`);
                            }}
                            disabled={disabled}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-sm whitespace-nowrap">A cada</Label>
                        <Input
                            type="number"
                            min="1"
                            max="99"
                            value={recorrencia.intervalo || 1}
                            onChange={(e) =>
                                onChangeRecorrencia({ ...recorrencia, intervalo: Math.max(1, Number(e.target.value)) })
                            }
                            disabled={disabled}
                            className="w-16"
                        />
                        <Select
                            value={recorrencia.frequencia || 'semanal'}
                            onValueChange={(v: RecorrenciaConfig['frequencia']) =>
                                onChangeRecorrencia({ ...recorrencia, frequencia: v })
                            }
                            disabled={disabled}
                        >
                            <SelectTrigger className="flex-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="diaria">dia(s)</SelectItem>
                                <SelectItem value="semanal">semana(s)</SelectItem>
                                <SelectItem value="mensal">mês(es)</SelectItem>
                                <SelectItem value="anual">ano(s)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {recorrencia.frequencia === 'semanal' && (
                        <div>
                            <Label className="mb-1.5 block text-sm">Dias da semana</Label>
                            <div className="flex gap-1">
                                {DIAS_SEMANA.map((dia) => {
                     

                                    const ativo = (recorrencia.dias_semana ?? []).includes(dia.value);
                                    return (
                                        <button
                                            key={dia.value}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => toggleDia(dia.value)}
                                            title={dia.full}
                                            className={cn(
                                                'w-8 h-8 rounded-full text-xs font-medium border transition-colors',
                                                ativo
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                                            )}
                                        >
                                            {dia.short}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <Label htmlFor="fim-recorrencia" className="mb-1.5 block text-sm">
                            Encerramento{' '}
                            <span className="text-muted-foreground font-normal">(opcional)</span>
                        </Label>
                        <Input
                            id="fim-recorrencia"
                            type="date"
                            value={recorrencia.fim_recorrencia || ''}
                            onChange={(e) =>
                                onChangeRecorrencia({ ...recorrencia, fim_recorrencia: e.target.value })
                            }
                            disabled={disabled}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

