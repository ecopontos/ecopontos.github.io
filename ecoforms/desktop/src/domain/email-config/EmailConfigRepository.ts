import type { EmailConfig } from './EmailConfig';

export interface EmailConfigRepository {
    get(): Promise<EmailConfig | null>;
    save(config: EmailConfig): Promise<void>;
}
