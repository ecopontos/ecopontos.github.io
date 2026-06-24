export interface DataRegistryItemProps {
    id: string;
    tipo: string;
    conteudo: unknown;
    criadoEm?: string;
    atualizadoEm?: string;
}

export class DataRegistryItem {
    private constructor(private props: DataRegistryItemProps) {}

    static fromProps(props: DataRegistryItemProps): DataRegistryItem {
        return new DataRegistryItem({ ...props });
    }

    toProps(): DataRegistryItemProps {
        return { ...this.props };
    }

    get id(): string { return this.props.id; }
    get tipo(): string { return this.props.tipo; }
    get conteudo(): unknown { return this.props.conteudo; }

    updateConteudo(conteudo: unknown): void {
        this.props.conteudo = conteudo;
    }
}
