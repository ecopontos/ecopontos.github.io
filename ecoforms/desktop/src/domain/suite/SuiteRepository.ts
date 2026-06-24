import type { SuitePackage } from './SuitePackage';
import type { SuiteStatus } from './SuiteStatus';

export interface SuiteQuery {
    ownerId?: string;
    status?: SuiteStatus | SuiteStatus[];
    moduleType?: string;
    resourceType?: string;
    isCurrent?: boolean;
    entityId?: string;
    entityType?: string;
    limit?: number;
}

export interface SuiteRepository {
    findById(packageId: string): Promise<SuitePackage | null>;
    findCurrent(resourceType: string, ownerId?: string): Promise<SuitePackage[]>;
    query(filter: SuiteQuery): Promise<SuitePackage[]>;
    save(pkg: SuitePackage): Promise<void>;
    invalidateCurrent(packageId: string): Promise<void>;
    appendHistory(entry: SuiteHistoryEntry): Promise<void>;
    /**
     * Valida que referenciar refPackageId a partir deste packageId não cria ciclo
     * na cadeia de ref_package_id. Retorna true se seguro, false se ciclo detectado.
     * Max depth: 50 (limite de segurança).
     */
    validateNoCycle(packageId: string, refPackageId: string, maxDepth?: number): Promise<boolean>;
    getFormTemplate(slug: string): Promise<Record<string, unknown> | null>;
}

export interface SuiteHistoryEntry {
    packageId: string;
    versionFrom: number | null;
    versionTo: number;
    statusAnterior: string | null;
    statusNovo: string;
    alteradoPor: string | null;
    motivo?: string | null;
    transferType?: 'share' | 'transfer' | null;
}
