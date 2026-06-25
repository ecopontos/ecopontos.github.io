import { InvalidTransitionError } from '../shared/errors';
import { isValidSuiteTransition, type SuiteStatus } from './SuiteStatus';

export interface SuitePackageProps {
    packageId: string;
    versionNo: number;
    moduleType: string;
    resourceType: string;
    status: SuiteStatus;
    ownerId: string | null;
    isCurrent: boolean;
    lockedBy: string | null;
    lockedAt: string | null;
    refPackageId: string | null;
    refPackageVer: number | null;
    entityId: string | null;
    entityType: string | null;
    payloadJson: string;
    createdAt: string;
    closedAt: string | null;
}

/**
 * Entidade de domínio para pacotes suite (contrato v2).
 * Encapsula transições de status, lock/unlock e parsing do payload.
 */
export class SuitePackage {
    private constructor(private props: SuitePackageProps) {}

    static fromProps(props: SuitePackageProps): SuitePackage {
        return new SuitePackage({ ...props });
    }

    toProps(): SuitePackageProps {
        return { ...this.props };
    }

    get id(): string { return this.props.packageId; }
    get packageId(): string { return this.props.packageId; }
    get status(): SuiteStatus { return this.props.status; }
    get versionNo(): number { return this.props.versionNo; }
    get ownerId(): string | null { return this.props.ownerId; }
    get isCurrent(): boolean { return this.props.isCurrent; }
    get isLocked(): boolean { return !!this.props.lockedBy; }
    get payloadJson(): string { return this.props.payloadJson; }
    get moduleType(): string { return this.props.moduleType; }
    get resourceType(): string { return this.props.resourceType; }

    transitionTo(newStatus: SuiteStatus): void {
        if (!isValidSuiteTransition(this.props.status, newStatus)) {
            throw new InvalidTransitionError(this.props.status, newStatus, 'SuitePackage');
        }
        this.props.status = newStatus;
    }

    lock(userId: string, atIso: string): void {
        this.transitionTo('locked');
        this.props.lockedBy = userId;
        this.props.lockedAt = atIso;
    }

    unlock(userId: string): void {
        if (this.props.lockedBy !== null && this.props.lockedBy !== userId) {
            throw new Error(`Suite locked by ${this.props.lockedBy}, cannot be unlocked by ${userId}`);
        }
        this.transitionTo('current');
        this.props.lockedBy = null;
        this.props.lockedAt = null;
    }

    submitForReview(): void {
        this.transitionTo('pending_review');
    }

    close(atIso: string): void {
        if (this.props.status !== 'closed') this.transitionTo('closed');
        this.props.closedAt = atIso;
        this.props.isCurrent = false;
    }

    updatePayload(json: string): void {
        this.props.payloadJson = json;
    }

    /**
     * Cria uma nova versão deste pacote com um novo payload.
     * Incrementa o versionNo e marca como atual.
     */
    createNewVersion(newPayload: string, atIso: string): SuitePackage {
        return new SuitePackage({
            ...this.props,
            versionNo: this.props.versionNo + 1,
            isCurrent: true,
            payloadJson: newPayload,
            createdAt: atIso,
            lockedBy: null,
            lockedAt: null,
        });
    }

    markAsHistory(): void {
        this.props.isCurrent = false;
    }

    getPayload<T = unknown>(): T {
        try {
            return JSON.parse(this.props.payloadJson) as T;
        } catch {
            return {} as T;
        }
    }

    toSyncJSON(): Record<string, unknown> {
        return {
            id: this.props.packageId,
            package_id: this.props.packageId,
            version_no: this.props.versionNo,
            module_type: this.props.moduleType,
            resource_type: this.props.resourceType,
            status: this.props.status,
            owner_id: this.props.ownerId,
            is_current: this.props.isCurrent ? 1 : 0,
            locked_by: this.props.lockedBy,
            locked_at: this.props.lockedAt,
            ref_package_id: this.props.refPackageId,
            ref_package_ver: this.props.refPackageVer,
            entity_id: this.props.entityId,
            entity_type: this.props.entityType,
            payload_json: this.props.payloadJson,
            created_at: this.props.createdAt,
            closed_at: this.props.closedAt,
        };
    }
}
