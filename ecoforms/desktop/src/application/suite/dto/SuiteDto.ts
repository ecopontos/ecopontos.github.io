import type { SuiteStatus } from '../../../domain/suite/SuiteStatus';

export interface SuiteDto {
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
    payload: unknown;
    createdAt: string;
    closedAt: string | null;
}

export interface SubmitSuiteInput {
    moduleType: string;
    resourceType: string;
    ownerId: string;
    payload: unknown;
    refPackageId?: string;
    refPackageVer?: number;
    entityId?: string;
    entityType?: string;
}

export interface ReviewSuiteInput {
    packageId: string;
    reviewerId: string;
    approve: boolean;
    motivo?: string;
}

export interface EditSuiteInput {
    packageId: string;
    editorId: string;
    payload: unknown;
}
