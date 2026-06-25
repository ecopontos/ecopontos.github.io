export type VisualType = 'table' | 'chart' | 'kanban' | 'timeline' | 'summary';
export type SyncStatus = 'synced' | 'outdated' | 'conflict';

export interface ModuleVisualViewProps {
    id: string;
    module_id: string;
    visual_type: VisualType;
    name: string;
    config: string;
    is_default: boolean;
    user_id: string | null;
    parent_view_id: string | null;
    sync_status: SyncStatus;
    position: number;
    criado_em: string;
    atualizado_em: string;
}

export class ModuleVisualView {
    private constructor(private props: ModuleVisualViewProps) {}

    static fromRow(row: Record<string, unknown>): ModuleVisualView {
        return new ModuleVisualView({
            id: row.id as string,
            module_id: row.module_id as string,
            visual_type: row.visual_type as VisualType,
            name: row.name as string,
            config: typeof row.config === 'string' ? row.config : JSON.stringify(row.config ?? {}),
            is_default: row.is_default === 1 || row.is_default === true,
            user_id: row.user_id as string | null,
            parent_view_id: row.parent_view_id as string | null,
            sync_status: (row.sync_status as SyncStatus) || 'synced',
            position: typeof row.position === 'number' ? row.position : parseInt(row.position as string) || 0,
            criado_em: row.criado_em as string,
            atualizado_em: row.atualizado_em as string,
        });
    }

    static fromProps(props: ModuleVisualViewProps): ModuleVisualView {
        return new ModuleVisualView({ ...props });
    }

    toRow(): Record<string, unknown> {
        return {
            id: this.props.id,
            module_id: this.props.module_id,
            visual_type: this.props.visual_type,
            name: this.props.name,
            config: this.props.config,
            is_default: this.props.is_default ? 1 : 0,
            user_id: this.props.user_id,
            parent_view_id: this.props.parent_view_id,
            sync_status: this.props.sync_status,
            position: this.props.position,
            criado_em: this.props.criado_em,
            atualizado_em: this.props.atualizado_em,
        };
    }

    get id(): string { return this.props.id; }
    get module_id(): string { return this.props.module_id; }
    get visual_type(): VisualType { return this.props.visual_type; }
    get name(): string { return this.props.name; }
    get config(): string { return this.props.config; }
    get is_default(): boolean { return this.props.is_default; }
    get user_id(): string | null { return this.props.user_id; }
    get parent_view_id(): string | null { return this.props.parent_view_id; }
    get sync_status(): SyncStatus { return this.props.sync_status; }
    get position(): number { return this.props.position; }

    isGlobal(): boolean { return this.props.user_id === null; }
    isPersonal(): boolean { return this.props.user_id !== null; }

    markOutdated(): ModuleVisualView {
        return new ModuleVisualView({ ...this.props, sync_status: 'outdated', atualizado_em: new Date().toISOString() });
    }

    updateConfig(config: string): ModuleVisualView {
        return new ModuleVisualView({ ...this.props, config, atualizado_em: new Date().toISOString() });
    }
}
