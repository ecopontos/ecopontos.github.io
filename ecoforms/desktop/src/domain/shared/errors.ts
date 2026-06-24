export class DomainError extends Error {
    constructor(message: string, public readonly code?: string) {
        super(message);
        this.name = 'DomainError';
    }
}

export class NotFoundError extends DomainError {
    constructor(entity: string, id: string) {
        super(`${entity} não encontrado: ${id}`, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class InvalidTransitionError extends DomainError {
    constructor(from: string, to: string, entity = 'Entity') {
        super(`Transição inválida em ${entity}: ${from} → ${to}`, 'INVALID_TRANSITION');
        this.name = 'InvalidTransitionError';
    }
}

export class CycleDetectedError extends DomainError {
    constructor(packageId: string, refPackageId: string) {
        super(`Referencia ciclica detectada: ${packageId} -> ${refPackageId}`, 'CYCLE_DETECTED');
        this.name = 'CycleDetectedError';
    }
}

export class SuiteLockedError extends DomainError {
    constructor(packageId: string, lockedBy: string) {
        super(`Suite ${packageId} está bloqueada por ${lockedBy}`, 'SUITE_LOCKED');
        this.name = 'SuiteLockedError';
    }
}

export class ValidationError extends DomainError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

export class ForbiddenError extends DomainError {
    constructor(message: string) {
        super(message, 'FORBIDDEN');
        this.name = 'ForbiddenError';
    }
}
