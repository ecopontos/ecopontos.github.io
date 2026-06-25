export interface DecisionRegistryProps {
    id: string;
    targetType: string;
    action: string;
    perfis: string[];
    enabledWhen: unknown[];
    steps: unknown[];
    params: Record<string, unknown>;
    consequenceType: string;
    consequencePattern?: string;
    consequenceConfig: Record<string, unknown>;
    ativo: boolean;
    criadoEm?: string;
    atualizadoEm?: string;
}

export class DecisionRegistry {
    private constructor(private props: DecisionRegistryProps) {}

    static fromRow(row: Record<string, unknown>): DecisionRegistry {
        return new DecisionRegistry({
            id: row.id as string,
            targetType: row.target_type as string,
            action: row.action as string,
            perfis: typeof row.perfis === 'string' ? JSON.parse(row.perfis as string) : (row.perfis as string[]) || [],
            enabledWhen: typeof row.enabled_when === 'string' ? JSON.parse(row.enabled_when as string) : (row.enabled_when as unknown[]) || [],
            steps: typeof row.steps === 'string' ? JSON.parse(row.steps as string) : (row.steps as unknown[]) || [],
            params: typeof row.params === 'string' ? JSON.parse(row.params as string) : (row.params as Record<string, unknown>) || {},
            consequenceType: (row.consequence_type as string) || 'terminal',
            consequencePattern: row.consequence_pattern as string | undefined,
            consequenceConfig: typeof row.consequence_config === 'string' ? JSON.parse(row.consequence_config as string) : (row.consequence_config as Record<string, unknown>) || {},
            ativo: row.ativo === 1 || row.ativo === true,
            criadoEm: row.criado_em as string | undefined,
            atualizadoEm: row.atualizado_em as string | undefined,
        });
    }

    static fromProps(props: DecisionRegistryProps): DecisionRegistry {
        return new DecisionRegistry({ ...props });
    }

    toRow(): Record<string, unknown> {
        return {
            id: this.props.id,
            target_type: this.props.targetType,
            action: this.props.action,
            perfis: JSON.stringify(this.props.perfis),
            enabled_when: JSON.stringify(this.props.enabledWhen),
            steps: JSON.stringify(this.props.steps),
            params: JSON.stringify(this.props.params),
            consequence_type: this.props.consequenceType,
            consequence_pattern: this.props.consequencePattern || null,
            consequence_config: JSON.stringify(this.props.consequenceConfig),
            ativo: this.props.ativo ? 1 : 0,
            criado_em: this.props.criadoEm,
            atualizado_em: this.props.atualizadoEm,
        };
    }

    get id(): string { return this.props.id; }
    get targetType(): string { return this.props.targetType; }
    get action(): string { return this.props.action; }
    get perfis(): string[] { return this.props.perfis; }
    get enabledWhen(): unknown[] { return this.props.enabledWhen; }
    get steps(): unknown[] { return this.props.steps; }
    get params(): Record<string, unknown> { return this.props.params; }
    get consequenceType(): string { return this.props.consequenceType; }
    get consequencePattern(): string | undefined { return this.props.consequencePattern; }
    get consequenceConfig(): Record<string, unknown> { return this.props.consequenceConfig; }
    get ativo(): boolean { return this.props.ativo; }
}