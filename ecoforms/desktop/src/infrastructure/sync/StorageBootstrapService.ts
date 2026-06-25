import type { SqlitePort } from '../../application/ports/SqlitePort';
import type { OrgConfig, OrgSetor } from './OrgConfigService';
import type { SyncStoragePort } from './SyncStoragePort';
import type { LanFileStorage } from '../storage/LanFileStorage';

const BUCKET = 'sync-bucket';

const DEFAULT_ORG_ID = 'ecoforms-org-001';
const DEFAULT_ORG_NAME = 'Organização EcoForms';

function createDefaultOrgConfig(deviceSectorId?: string): OrgConfig {
    const setores: OrgSetor[] = [
        { id: 'setor-admin', nome: 'Administração Geral', ativo: true },
        { id: 'setor-ambiente', nome: 'Meio Ambiente', ativo: true },
        { id: 'setor-coleta', nome: 'Coleta de Resíduos', ativo: true },
        { id: 'setor-fiscalizacao', nome: 'Fiscalização Ambiental', ativo: true },
    ];

    if (deviceSectorId && !setores.find(s => s.id === deviceSectorId)) {
        setores.push({ id: deviceSectorId, nome: `Setor ${deviceSectorId}`, ativo: true });
    }

    return {
        org_id: DEFAULT_ORG_ID,
        org_nome: DEFAULT_ORG_NAME,
        setores,
        updated_at: new Date().toISOString(),
    };
}

export class StorageBootstrapService {
    constructor(
        private storage: SyncStoragePort,
        private sqlite: SqlitePort,
        private lan?: LanFileStorage,
    ) {}

    /**
     * Verifica se o Storage está pronto para sync.
     * Se não estiver, cria as estruturas mínimas necessárias:
     * - shared/org_config.json
     * - shared/.bootstrap_marker (arquivo de controle)
     */
    async bootstrapIfNeeded(deviceSectorId?: string): Promise<{
        created: boolean;
        config: OrgConfig;
        message: string;
    }> {
        // 0. Garantir que o bucket existe (cria automaticamente se tiver permissão)
        const bucketCheck = await this.storage.ensureBucket(BUCKET);
        if (!bucketCheck.ok) {
            console.warn(
                `[StorageBootstrap] Bucket "${BUCKET}" inacessível: ${bucketCheck.reason}. ` +
                'Crie o bucket no painel do Supabase e adicione as policies necessárias.'
            );
            const defaultConfig = createDefaultOrgConfig(deviceSectorId);
            await this.cacheConfig(defaultConfig);
            return {
                created: false,
                config: defaultConfig,
                message: `Bucket "${BUCKET}" não encontrado. Crie-o no Supabase Storage com as policies de leitura/escrita.`,
            };
        }

        try {
            // 1. Tentar baixar config existente
            const blob = await this.storage.download('shared/org_config.json');
            const text = await blob.text();
            const config = JSON.parse(text) as OrgConfig;

            // Já existe — apenas cacheia localmente e espelha na LAN
            await this.cacheConfig(config);
            if (this.lan) {
                this.lan.writeJson('shared/org_config.json', config).catch(() => {});
            }
            return {
                created: false,
                config,
                message: 'Configuração existente carregada do Storage.',
            };
        } catch {
            // Não existe no Storage — criar default e fazer upload
            console.log('[StorageBootstrap] org_config.json não encontrado. Criando default...');
        }

        const defaultConfig = createDefaultOrgConfig(deviceSectorId);

        try {
            // 2. Fazer upload do org_config.json default
            const jsonBlob = new Blob([JSON.stringify(defaultConfig, null, 2)], {
                type: 'application/json',
            });
            await this.storage.upload('shared/org_config.json', jsonBlob);

            // 3. Criar marker de bootstrap
            const markerBlob = new Blob(
                [`bootstrap_at=${new Date().toISOString()}\ndevice_sector=${deviceSectorId ?? 'unknown'}\n`],
                { type: 'text/plain' }
            );
            await this.storage.upload('shared/.bootstrap_marker', markerBlob);

            // 4. Cachear localmente e espelhar na LAN
            await this.cacheConfig(defaultConfig);

            if (this.lan) {
                this.lan.writeJson('shared/org_config.json', defaultConfig).catch(() => {});
            }

            console.log('[StorageBootstrap] Estruturas criadas com sucesso no Storage.');
            return {
                created: true,
                config: defaultConfig,
                message: 'Estrutura de sync criada no Storage (instalação inicial).',
            };
        } catch (uploadErr: unknown) {
            console.warn('[StorageBootstrap] Falha ao criar arquivos no Storage:', uploadErr instanceof Error ? uploadErr.message : uploadErr);

            // Cachear localmente para o app funcionar offline
            await this.cacheConfig(defaultConfig);

            return {
                created: false,
                config: defaultConfig,
                message: 'Usando configuração local (Storage indisponível).',
            };
        }
    }

    private async cacheConfig(config: OrgConfig): Promise<void> {
        await this.sqlite.execute(
            `INSERT OR REPLACE INTO registro_dados (tipo, chave, conteudo, atualizado_em)
             VALUES ('org_config', 'current', ?, ?)`,
            [JSON.stringify(config), config.updated_at]
        );
    }
}
