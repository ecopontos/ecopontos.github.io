import React from 'react';
import { User, Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { Interessado } from '@/types';
import { useTaskOptions } from '@/src/interface/hooks/catalog/kanban';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface StakeholdersSelectProps {
    value: Interessado[];
    onChange: (value: Interessado[]) => void;
    label?: string;
}

export function StakeholdersSelect({ value, onChange, label = 'Interessados' }: StakeholdersSelectProps) {
    const { users } = useTaskOptions();
    
    // Filtra usuários que já foram selecionados
    const availableUsers = users.filter(u => !value.some(v => v.usuario_id === u.value));

    const addStakeholder = (userId: string) => {
        const user = users.find(u => u.value === userId);
        if (!user) return;
        
        onChange([...value, { 
            usuario_id: userId, 
            permissao: 'leitura',
            nome: user.label 
        }]);
    };

    const removeStakeholder = (userId: string) => {
        onChange(value.filter(v => v.usuario_id !== userId));
    };

    const togglePermission = (userId: string) => {
        onChange(value.map(v => {
            if (v.usuario_id === userId) {
                return { 
                    ...v, 
                    permissao: v.permissao === 'leitura' ? 'edicao' : 'leitura' 
                };
            }
            return v;
        }));
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {label}
                </label>
            </div>

            <div className="flex gap-2">
                <Select onValueChange={addStakeholder}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Adicionar interessado..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableUsers.length === 0 ? (
                            <div className="p-2 text-xs text-center text-muted-foreground">
                                Todos os usuários adicionados
                            </div>
                        ) : (
                            availableUsers.map(u => (
                                <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
                {value.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Nenhum interessado selecionado</span>
                )}
                {value.map(s => {
                    const userLabel = s.nome || users.find(u => u.value === s.usuario_id)?.label || 'Usuário';
                    return (
                        <Badge 
                            key={s.usuario_id} 
                            variant="secondary" 
                            className="pl-2 pr-1 py-1 flex items-center gap-1 group"
                        >
                            <span className="max-w-[120px] truncate">{userLabel}</span>
                            
                            <button
                                onClick={() => togglePermission(s.usuario_id)}
                                className="p-0.5 hover:bg-background/20 rounded transition-colors"
                                title={s.permissao === 'leitura' ? 'Somente Leitura' : 'Pode Editar'}
                            >
                                {s.permissao === 'leitura' ? (
                                    <Eye className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                    <Pencil className="w-3 h-3 text-primary" />
                                )}
                            </button>

                            <button
                                onClick={() => removeStakeholder(s.usuario_id)}
                                className="p-0.5 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </Badge>
                    );
                })}
            </div>
        </div>
    );
}
