import { SuitePackage } from '../../domain/suite/SuitePackage';
import type { SuiteHistoryEntry, SuiteQuery, SuiteRepository } from '../../domain/suite/SuiteRepository';

export class InMemorySuiteRepository implements SuiteRepository {
    private store = new Map<string, SuitePackage[]>();
    private history: SuiteHistoryEntry[] = [];

    async findById(packageId: string): Promise<SuitePackage | null> {
        const versions = this.store.get(packageId);
        if (!versions || versions.length === 0) return null;
        return versions[versions.length - 1];
    }

    async findCurrent(resourceType: string, ownerId?: string): Promise<SuitePackage[]> {
        return [...this.store.values()]
            .flat()
            .filter((pkg) => pkg.isCurrent && pkg.toProps().resourceType === resourceType)
            .filter((pkg) => ownerId === undefined || pkg.ownerId === ownerId);
    }

    async query(filter: SuiteQuery): Promise<SuitePackage[]> {
        return [...this.store.values()]
            .flat()
            .filter((pkg) => {
                const props = pkg.toProps();
                if (filter.ownerId !== undefined && props.ownerId !== filter.ownerId) return false;
                if (filter.status !== undefined) {
                    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
                    if (!statuses.includes(props.status)) return false;
                }
                if (filter.moduleType !== undefined && props.moduleType !== filter.moduleType) return false;
                if (filter.resourceType !== undefined && props.resourceType !== filter.resourceType) return false;
                if (filter.isCurrent !== undefined && props.isCurrent !== filter.isCurrent) return false;
                return true;
            })
            .slice(0, filter.limit ?? Infinity);
    }

    async save(pkg: SuitePackage): Promise<void> {
        const versions = this.store.get(pkg.packageId) ?? [];
        const index = versions.findIndex((v) => v.toProps().versionNo === pkg.toProps().versionNo);
        if (index >= 0) {
            versions[index] = pkg;
        } else {
            versions.push(pkg);
        }
        this.store.set(pkg.packageId, versions);
    }

    async appendHistory(entry: SuiteHistoryEntry): Promise<void> {
        this.history.push({ ...entry });
    }

    getHistory(): SuiteHistoryEntry[] {
        return [...this.history];
    }

    async invalidateCurrent(packageId: string): Promise<void> {
        const versions = this.store.get(packageId) ?? [];
        for (const v of versions) {
            Object.assign(v, { isCurrent: false });
        }
    }

    async validateNoCycle(): Promise<boolean> {
        return true;
    }

    async getFormTemplate(): Promise<Record<string, unknown> | null> {
        return null;
    }
}
