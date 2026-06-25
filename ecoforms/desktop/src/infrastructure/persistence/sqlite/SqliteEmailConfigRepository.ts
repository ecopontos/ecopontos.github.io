import { EmailConfig } from '../../../domain/email-config/EmailConfig';
import type { EmailConfigRepository } from '../../../domain/email-config/EmailConfigRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface EmailConfigRow {
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
}

function rowToEntity(row: EmailConfigRow): EmailConfig {
    return EmailConfig.fromRow(row);
}

export class SqliteEmailConfigRepository implements EmailConfigRepository {
    constructor(private readonly db: SqlitePort) {}

    async get(): Promise<EmailConfig | null> {
        const rows = await this.db.query<EmailConfigRow>(
            `SELECT id, smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name, use_tls, enabled, atualizado_em
             FROM tbl_email_config WHERE id = 'default' LIMIT 1`
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async save(config: EmailConfig): Promise<void> {
        const row = config.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM tbl_email_config WHERE id = 'default' LIMIT 1`
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO tbl_email_config (id, smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name, use_tls, enabled, atualizado_em)
                 VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [row.smtp_host, row.smtp_port, row.smtp_user, row.smtp_password, row.from_email, row.from_name, row.use_tls, row.enabled]
            );
        } else {
            await this.db.execute(
                `UPDATE tbl_email_config SET smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_password = ?,
                 from_email = ?, from_name = ?, use_tls = ?, enabled = ?, atualizado_em = datetime('now') WHERE id = 'default'`,
                [row.smtp_host, row.smtp_port, row.smtp_user, row.smtp_password, row.from_email, row.from_name, row.use_tls, row.enabled]
            );
        }
    }
}
