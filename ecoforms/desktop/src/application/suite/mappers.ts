import type { SuitePackage } from '../../domain/suite/SuitePackage';
import type { SuiteDto } from './dto/SuiteDto';

export function toSuiteDto(pkg: SuitePackage): SuiteDto {
    const p = pkg.toProps();
    let payload: unknown;
    try {
        payload = JSON.parse(p.payloadJson);
    } catch {
        payload = {};
    }
    return {
        packageId: p.packageId,
        versionNo: p.versionNo,
        moduleType: p.moduleType,
        resourceType: p.resourceType,
        status: p.status,
        ownerId: p.ownerId,
        isCurrent: p.isCurrent,
        lockedBy: p.lockedBy,
        lockedAt: p.lockedAt,
        refPackageId: p.refPackageId,
        refPackageVer: p.refPackageVer,
        entityId: p.entityId,
        entityType: p.entityType,
        payload,
        createdAt: p.createdAt,
        closedAt: p.closedAt,
    };
}
