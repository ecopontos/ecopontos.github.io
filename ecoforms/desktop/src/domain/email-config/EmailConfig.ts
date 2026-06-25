export interface EmailConfigProps {
    id: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
    useTls: boolean;
    enabled: boolean;
    atualizadoEm: string | null;
}

export class EmailConfig {
    private constructor(private readonly props: EmailConfigProps) {}

    static fromProps(props: EmailConfigProps): EmailConfig {
        return new EmailConfig(props);
    }

    static fromRow(row: {
        id: string;
        smtp_host: string;
        smtp_port: number;
        smtp_user: string;
        smtp_password: string;
        from_email: string;
        from_name: string;
        use_tls: number;
        enabled: number;
        atualizado_em: string | null;
    }): EmailConfig {
        return new EmailConfig({
            id: row.id,
            smtpHost: row.smtp_host,
            smtpPort: row.smtp_port,
            smtpUser: row.smtp_user,
            smtpPassword: row.smtp_password,
            fromEmail: row.from_email,
            fromName: row.from_name,
            useTls: row.use_tls === 1,
            enabled: row.enabled === 1,
            atualizadoEm: row.atualizado_em,
        });
    }

    get id(): string { return this.props.id; }
    get smtpHost(): string { return this.props.smtpHost; }
    get smtpPort(): number { return this.props.smtpPort; }
    get smtpUser(): string { return this.props.smtpUser; }
    get smtpPassword(): string { return this.props.smtpPassword; }
    get fromEmail(): string { return this.props.fromEmail; }
    get fromName(): string { return this.props.fromName; }
    get useTls(): boolean { return this.props.useTls; }
    get enabled(): boolean { return this.props.enabled; }
    get atualizadoEm(): string | null { return this.props.atualizadoEm; }

    toRow(): {
        id: string;
        smtp_host: string;
        smtp_port: number;
        smtp_user: string;
        smtp_password: string;
        from_email: string;
        from_name: string;
        use_tls: number;
        enabled: number;
        atualizado_em: string | null;
    } {
        return {
            id: this.props.id,
            smtp_host: this.props.smtpHost,
            smtp_port: this.props.smtpPort,
            smtp_user: this.props.smtpUser,
            smtp_password: this.props.smtpPassword,
            from_email: this.props.fromEmail,
            from_name: this.props.fromName,
            use_tls: this.props.useTls ? 1 : 0,
            enabled: this.props.enabled ? 1 : 0,
            atualizado_em: this.props.atualizadoEm,
        };
    }
}
