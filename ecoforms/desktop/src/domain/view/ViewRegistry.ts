export interface ViewRegistryProps {
    id: string;
    titulo: string;
    perfis: string[];
    layout: string;
    widgets: unknown[];
    moduleType?: string;
    userId?: string | null;
    isTemplate?: boolean;
    ativo: boolean;
    criadoEm?: string;
    atualizadoEm?: string;
}

export class ViewRegistry {
    private constructor(private props: ViewRegistryProps) {}

    static fromRow(row: Record<string, unknown>): ViewRegistry {
        return new ViewRegistry({
            id: row.id as string,
            titulo: row.titulo as string,
            perfis: typeof row.perfis === 'string' ? JSON.parse(row.perfis as string) : (row.perfis as string[]) || [],
            layout: (row.layout as string) || 'grid-2',
            widgets: typeof row.widgets === 'string' ? JSON.parse(row.widgets as string) : (row.widgets as unknown[]) || [],
            moduleType: row.module_type as string | undefined,
            userId: row.user_id as string | null | undefined,
            isTemplate: row.is_template === 1 || row.is_template === true,
            ativo: row.ativo === 1 || row.ativo === true,
            criadoEm: row.criado_em as string | undefined,
            atualizadoEm: row.atualizado_em as string | undefined,
        });
    }

    static fromProps(props: ViewRegistryProps): ViewRegistry {
        return new ViewRegistry({ ...props });
    }

    toRow(): Record<string, unknown> {
        return {
            id: this.props.id,
            titulo: this.props.titulo,
            perfis: JSON.stringify(this.props.perfis),
            layout: this.props.layout,
            widgets: JSON.stringify(this.props.widgets),
            module_type: this.props.moduleType || null,
            user_id: this.props.userId ?? null,
            is_template: this.props.isTemplate ? 1 : 0,
            ativo: this.props.ativo ? 1 : 0,
            criado_em: this.props.criadoEm,
            atualizado_em: this.props.atualizadoEm,
        };
    }

    get id(): string { return this.props.id; }
    get titulo(): string { return this.props.titulo; }
    get perfis(): string[] { return this.props.perfis; }
    get layout(): string { return this.props.layout; }
    get widgets(): unknown[] { return this.props.widgets; }
    get moduleType(): string | undefined { return this.props.moduleType; }
    get userId(): string | null | undefined { return this.props.userId; }
    get isTemplate(): boolean { return this.props.isTemplate ?? false; }
    get ativo(): boolean { return this.props.ativo; }
}