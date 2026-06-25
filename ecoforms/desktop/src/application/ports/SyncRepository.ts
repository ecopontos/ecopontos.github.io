export interface SyncRepository {
    // --- Push Operations ---
    /** Fetch tasks ready to be synced incrementally */
    getActiveTasksForSync(): Promise<Record<string, unknown>[]>;
    
    /** Fetch tasks that need full snapshots (have forms attached) */
    getTasksWithFormRegistry(): Promise<Record<string, unknown>[]>;
    
    /** Get the form schema to attach to a snapshot */
    getFormRegistrySchema(formId: string): Promise<Record<string, unknown> | null>;
    
    /** Get the latest aggregated state for Ecoponto */
    getEcopontoState(): Promise<Record<string, unknown>[]>;

    // --- Pull Operations ---
    /** Bulk upsert tasks received from remote */
    upsertTasks(records: Record<string, unknown>[]): Promise<void>;
    
    /** Bulk upsert suite records received from remote */
    upsertTblSuite(records: Record<string, unknown>[], currentIsoTime: string): Promise<void>;

    // --- Patch Operations ---
    /** Get frozen tasks that might have patches */
    getFrozenTaskRecipients(): Promise<{ id: string; atribuido_para: string }[]>;
    
    /** Apply a patch to a specific task */
    applyTaskPatch(taskId: string, patchData: Record<string, unknown>): Promise<boolean>;
}
