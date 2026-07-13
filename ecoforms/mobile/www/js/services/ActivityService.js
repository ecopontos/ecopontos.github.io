class ActivityService {
    constructor() {
        this.activities = [];
        this.dbName = 'ActivityDB';
        this.storeName = 'userActivities';
        this.db = null;
        this.lastDiagnostics = null;
        // Tracks IDs completed this session so fetchActivities doesn't re-show them
        // before the Desktop processes and removes the Storage snapshot.
        this._completedIds = new Set();
    }

    async init() {
        console.log('🗄️ [ActivityService] Inicializando IndexedDB para cache de atividades...');

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 3); // v3: Legacy cleanup for discontinued modules

            request.onerror = (event) => {
                console.error("❌ [ActivityService] ActivityDB open error", event);
                reject(event);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                
                if (oldVersion < 1) {
                    console.log('🔧 [ActivityService] Criando objectStore:', this.storeName);
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                        store.createIndex('status', 'status', { unique: false });
                        store.createIndex('assignee_id', 'assignee_id', { unique: false });
                    }
                }
                
                // v3: Legacy cleanup - Delete 'dispatches' store from discontinued module
                if (db.objectStoreNames.contains('dispatches')) {
                    db.deleteObjectStore('dispatches');
                    console.log('🗑️ [ActivityService] ObjectStore "dispatches" removido (módulo descontinuado)');
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("✅ [ActivityService] ActivityDB inicializado com sucesso");
                resolve(this.db);
            };
        });
    }

    /**
     * Promise-wrapped helper to get a record from IndexedDB
     * @private
     */
    async _get(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error(`Get failed for ${id}`));
        });
    }

    /**
     * Promise-wrapped helper to put a record into IndexedDB
     * @private
     */
    async _put(data) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Put failed'));
        });
    }

    /**
     * Promise-wrapped helper to delete a record from IndexedDB
     * @private
     */
    async _delete(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error(`Delete failed for ${id}`));
        });
    }

    hasFormPermission(user, formId) {
        if (!formId) return false;

        const fullAccessRoles = ['admin', 'gerente'];
        if (fullAccessRoles.includes(user?.perfil)) {
            return true;
        }

        const allowedForms = Array.isArray(user?.formulariosPermitidos) ? user.formulariosPermitidos : [];
        return allowedForms.includes('*') || allowedForms.includes(formId);
    }

    getTaskVisibilityDiagnostics(task, user) {
        const validStatus = ['a_fazer', 'em_progresso'].includes(task.status);
        const isAssignee = task.atribuido_para === user.id;
        const isAdmin = user.perfil === 'admin';
        const isManager = user.perfil === 'gerente';
        const userSectors = Array.isArray(user.setores) ? user.setores : [];
        const isInSector = task.setor_id && userSectors.includes(task.setor_id);
        const canSee = isAssignee || isAdmin || (isManager && isInSector);
        const hasForm = !!task.form_registry_id;
        const archived = task.arquivado === true || task.arquivado === 1 || task.arquivado === '1';
        const notArchived = !archived;
        const hasPermission = hasForm && this.hasFormPermission(user, task.form_registry_id);

        const reasons = [];
        if (!validStatus) reasons.push(`status (${task.status})`);
        if (!canSee) {
            let reason = 'visibility';
            if (!isAssignee && !isAdmin) {
                if (isManager) reason += ` (Manager NOT in sector: task=${task.setor_id}, user=${userSectors.join(',')})`;
                else reason += ` (Not assigned: task.atrib=${task.atribuido_para}, user.id=${user.id})`;
            }
            reasons.push(reason);
        }
        if (!hasForm) reasons.push('form (missing form_registry_id)');
        if (!notArchived) reasons.push('archived');
        if (validStatus && canSee && hasForm && notArchived && !hasPermission) reasons.push(`permission (form ${task.form_registry_id} not allowed)`);

        return {
            visible: reasons.length === 0,
            requiresPermissionRefresh: validStatus && canSee && hasForm && notArchived && !hasPermission,
            reasons,
            details: {
                taskId: task.id,
                title: task.titulo,
                assignee: task.atribuido_para,
                userId: user.id,
                userPerfil: user.perfil,
                taskSector: task.setor_id,
                userSectors: userSectors
            }
        };
    }

    parseStructuredValue(value, fallback) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }

        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (error) {
                return fallback;
            }
        }

        return value;
    }

    normalizePriority(priority) {
        const normalized = String(priority || 'media').trim().toLowerCase();
        const aliases = {
            low: 'baixa',
            baixa: 'baixa',
            medium: 'media',
            media: 'media',
            high: 'alta',
            alta: 'alta',
            critical: 'critica',
            critica: 'critica'
        };

        return aliases[normalized] || normalized || 'media';
    }

    normalizeStatus(status) {
        const normalized = String(status || 'a_fazer').trim().toLowerCase();
        const aliases = {
            todo: 'a_fazer',
            dispatched: 'a_fazer',
            in_progress: 'em_progresso',
            em_andamento: 'em_progresso',
            completed: 'concluido',
            done: 'concluido'
        };

        return aliases[normalized] || normalized || 'a_fazer';
    }

    isInternalPayloadKey(key) {
        return [
            'activity_id',
            'task_id',
            'tbl_suite_id',
            'id',
            'uuid',
            'created_at',
            'updated_at',
            'status',
            'syncstatus',
            'sync_status'
        ].includes(String(key || '').toLowerCase());
    }

    isMeaningfulValue(value) {
        if (value === null || value === undefined) {
            return false;
        }

        if (typeof value === 'string') {
            return value.trim() !== '';
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return true;
        }

        if (Array.isArray(value)) {
            return value.length > 0;
        }

        if (typeof value === 'object') {
            return Object.keys(value).length > 0;
        }

        return false;
    }

    formatPayloadValue(value) {
        if (value === null || value === undefined) {
            return '-';
        }

        if (typeof value === 'boolean') {
            return value ? 'Sim' : 'Não';
        }

        if (typeof value === 'number') {
            return String(value);
        }

        if (Array.isArray(value)) {
            return value
                .map((item) => this.formatPayloadValue(item))
                .filter(Boolean)
                .join(', ');
        }

        if (typeof value === 'object') {
            const labelCandidate = value.label || value.nome || value.name || value.value || value.id;
            if (typeof labelCandidate === 'string' || typeof labelCandidate === 'number') {
                return String(labelCandidate);
            }

            try {
                return JSON.stringify(value);
            } catch (error) {
                return '[objeto]';
            }
        }

        return String(value);
    }

    formatFieldLabel(key) {
        return String(key || '')
            .split('_')
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    buildPayloadSummary(payload) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return [];
        }

        return Object.entries(payload)
            .filter(([key, value]) => !this.isInternalPayloadKey(key) && this.isMeaningfulValue(value))
            .map(([key, value]) => ({
                key,
                label: this.formatFieldLabel(key),
                value: this.formatPayloadValue(value)
            }));
    }

    deriveLocation(task, payload) {
        const candidate = task.location
            || payload.location
            || payload.localizacao
            || payload.localizacao_gps
            || payload.endereco
            || payload.nome_ecoponto
            || payload.ecoponto
            || payload.bairro
            || null;

        if (!candidate) {
            return { raw: null, label: '' };
        }

        if (typeof candidate === 'string') {
            return {
                raw: candidate,
                label: candidate.trim()
            };
        }

        if (typeof candidate === 'object') {
            const label = candidate.label
                || candidate.nome
                || candidate.name
                || candidate.endereco
                || [candidate.latitude, candidate.longitude].filter(Boolean).join(', ');

            return {
                raw: candidate,
                label: label ? String(label) : ''
            };
        }

        return {
            raw: candidate,
            label: String(candidate)
        };
    }

    deriveDueState(dueDate, status) {
        if (!dueDate || status === 'concluido') {
            return 'none';
        }

        const parsed = new Date(dueDate);
        if (Number.isNaN(parsed.getTime())) {
            return 'none';
        }

        const now = new Date();
        const dueDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

        if (diffDays < 0) {
            return 'overdue';
        }
        if (diffDays === 0) {
            return 'today';
        }
        if (diffDays <= 2) {
            return 'soon';
        }

        return 'upcoming';
    }

    buildActivity(task, options = {}) {
        if (!task) {
            return null;
        }

        const payload = this.parseStructuredValue(task.payload, {});
        const parsedPayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        const tags = this.parseStructuredValue(task.tags, []);
        const parsedTags = Array.isArray(tags) ? tags : [];
        const status = this.normalizeStatus(task.status);
        const priority = this.normalizePriority(task.prioridade || task.priority);
        const payloadSummary = this.buildPayloadSummary(parsedPayload);
        const location = this.deriveLocation(task, parsedPayload);
        const createdAt = task.created_at || task.criado_em || task.createdAt || null;
        const updatedAt = task.updated_at || task.updatedAt || createdAt;
        const dueDate = task.prazo || task.due_date || null;
        const completedAt = options.completedAt || task.completed_at || (status === 'concluido' ? updatedAt : null);
        const formId = task.tipo_form || task.form_registry_id || task.form_id || null;
        const formTitle = task.form_title || task.form_registry_title || task.formulario_titulo || task.formTitle || '';
        const originalTask = task.original_task || task;

        console.log(`📋 [ActivityService] Build activity: ${task.titulo || task.title}`, {
            id: task.id,
            status,
            formId,
            can_start: !!formId && status !== 'concluido'
        });

        return {
            id: task.id,
            title: task.titulo || task.title || 'Atividade sem título',
            description: task.descricao || task.description || '',
            status,
            priority,
            due_date: dueDate,
            due_state: this.deriveDueState(dueDate, status),
            form_id: formId,
            form_title: formTitle,
            assignee_id: task.atribuido_para || task.assignee_id || null,
            creator_id: task.criado_por || task.creator_id || null,
            setor_id: task.setor_id || null,
            tbl_suite_id: task.tbl_suite_id || null,
            created_at: createdAt,
            updated_at: updatedAt,
            completed_at: completedAt,
            location: location.raw,
            location_label: location.label,
            tags: parsedTags,
            payload: parsedPayload,
            payload_summary: payloadSummary,
            prefilled_count: payloadSummary.length,
            has_prefill: payloadSummary.length > 0,
            can_start: !!formId && status !== 'concluido',
            original_task: originalTask
        };
    }

    /**
     * Inicia uma tarefa e publica evento task.atualizada via pipeline de sync
     * @param {string} taskId - ID da tarefa
     */
    async startTask(taskId) {
        try {
            console.log(`🚀 [ActivityService] Iniciando tarefa: ${taskId}`);

            if (window.syncAdapter?.isStarted()) {
                await window.syncAdapter.publishEvent('task.atualizada', {
                    tarefa_id: taskId,
                    status: 'em_progresso',
                    started_at: new Date().toISOString(),
                    started_by_device: 'mobile'
                }, {
                    aggregateType: 'task',
                    aggregateId: taskId,
                    streamId: taskId,
                });
                await window.syncAdapter.syncNow();
            } else {
                console.warn(`⚠️ [ActivityService] SyncAdapter não iniciado — evento task.atualizada não publicado`);
            }

            this._completedIds.add(taskId);
            console.log(`✅ [ActivityService] Tarefa ${taskId} iniciada`);
            return { success: true };

        } catch (error) {
            console.error(`❌ [ActivityService] Erro ao iniciar tarefa ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Conclui uma tarefa e publica evento task.concluida via pipeline de sync
     * @param {string} taskId - ID da tarefa
     */
    async completeTask(taskId) {
        try {
            console.log(`✅ [ActivityService] Concluindo tarefa: ${taskId}`);

            if (window.syncAdapter?.isStarted()) {
                await window.syncAdapter.publishEvent('task.concluida', {
                    tarefa_id: taskId,
                    completed_at: new Date().toISOString(),
                    completed_by_device: 'mobile'
                }, {
                    aggregateType: 'task',
                    aggregateId: taskId,
                    streamId: taskId,
                });
                await window.syncAdapter.syncNow();
            } else {
                console.warn(`⚠️ [ActivityService] SyncAdapter não iniciado — evento task.concluida não publicado`);
            }

            this._completedIds.add(taskId);
            console.log(`✅ [ActivityService] Tarefa ${taskId} concluída`);
            return { success: true };

        } catch (error) {
            console.error(`❌ [ActivityService] Erro ao concluir tarefa ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Processa arquivos de limpeza de tarefas arquivadas/deletadas
     * @param {string} userInboxPath - Caminho da inbox do usuário
     */
    async processTaskCleanupFiles(userInboxPath) {
        try {
            console.log(`🧹 [ActivityService] Processing task cleanup files in ${userInboxPath}...`);

            // Listar arquivos de limpeza (task_cleanup_*.json)
            const { data: cleanupFiles, error } = await window.globalSupabaseClient
                .storage.from('sync-bucket').list(userInboxPath);

            if (error || !cleanupFiles) {
                console.log('   No cleanup files found');
                return;
            }

            const taskCleanupFiles = cleanupFiles.filter(file =>
                file.name.startsWith('task_cleanup_') && file.name.endsWith('.json')
            );

            if (taskCleanupFiles.length === 0) {
                console.log('   No task cleanup files to process');
                return;
            }

            let cleanedCount = 0;

            for (const file of taskCleanupFiles) {
                try {
                    const filePath = `${userInboxPath}/${file.name}`;
                    const { data: blob, error: downloadError } = await window.globalSupabaseClient
                        .storage.from('sync-bucket').download(filePath);

                    if (downloadError) {
                        console.warn(`   ⚠️ Failed to download cleanup file ${filePath}:`, downloadError.message);
                        continue;
                    }

                    const cleanupData = JSON.parse(await blob.text());

                    if (cleanupData.sync_type === 'task_cleanup' && cleanupData.data?.archived_tasks) {
                        for (const archivedTask of cleanupData.data.archived_tasks) {
                            const { id: taskId, action } = archivedTask;

                            // Remover do cache local
                            await this._delete(taskId);

                            // Também remover da lista de completadas localmente
                            this._completedIds.delete(taskId);

                            console.log(`   🗑️ Cleaned ${action} task ${taskId} from local cache`);
                            cleanedCount++;
                        }
                    }

                    // Mover arquivo para archive após processamento
                    const archivePath = `archive/${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}/${file.name}`;
                    await window.globalSupabaseClient.storage.from('sync-bucket').move(filePath, archivePath);

                } catch (fileError) {
                    console.warn(`   ⚠️ Failed to process cleanup file ${file.name}:`, fileError);
                }
            }

            if (cleanedCount > 0) {
                console.log(`   🧹 Cleaned ${cleanedCount} archived/deleted tasks from local cache`);
            }

        } catch (error) {
            console.error('❌ [ActivityService] Error processing task cleanup files:', error);
        }
    }

    /**
     * Helper de merge profundo para mesclar patches e WIP
     */
    _deepMerge(target, source) {
        if (!source || typeof source !== 'object') return target;
        if (!target || typeof target !== 'object') return source;

        const output = { ...target };
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!(key in target)) {
                    output[key] = source[key];
                } else {
                    output[key] = this._deepMerge(target[key], source[key]);
                }
            } else {
                output[key] = source[key];
            }
        });
        return output;
    }

    /**
     * Busca atividades — prefere evento pipeline, fallback para cache local
     * @deprecated O pipeline de eventos substitui o modelo de snapshots.
     * Este método agora prioriza SyncEventDB.
     */
    async fetchActivities() {
        console.log('🔍 [ActivityService] fetchActivities — priorizando event pipeline');

        const adapter = window.syncAdapter;
        if (adapter && adapter.isStarted()) {
            try {
                await this.syncFromEvents();
            } catch (e) {
                console.warn('[ActivityService] syncFromEvents falhou:', e);
            }
        }

        return this.getLocalActivities();
    }
                        const taskFolderPath = `${userInboxPath}/${taskId}`;
                        
                        console.log(`📂 [ActivityService] Explorando pasta da tarefa: ${taskId}`);
                        const { data: subItems, error: subError } = await window.globalSupabaseClient
                            .storage.from(BUCKET).list(taskFolderPath);
                            
                        if (!subError && subItems) {
                            if (!taskGroups[taskId]) taskGroups[taskId] = { base: null, patches: [] };
                            
                            subItems.forEach(file => {
                                const lowerName = file.name.toLowerCase();
                                const fullPath = `${taskFolderPath}/${file.name}`;
                                
                                if (lowerName === 'snapshot.json' || lowerName === 'snapshot.json.gz' || lowerName.endsWith('.snap')) {
                                    taskGroups[taskId].base = fullPath;
                                } else if (lowerName === 'patches' && file.id === null) {
                                    // Se houver subpasta de patches, deveríamos listar ela também se necessário
                                    // Por enquanto, o modelo Desktop simplificado coloca patches no root se for o caso
                                }
                            });
                        }
                    } 
                }

                // Processar cada grupo de tarefa encontrado
                for (const taskId in taskGroups) {
                    const group = taskGroups[taskId];
                    if (!group.base) continue; 

                    // Ordenar patches (se implementado futuramente)
                    group.patches.sort();

                    const activity = await this.downloadAndProcessSnap(group.base, group.patches);
                    if (activity) {
                        allActivities.push(activity);
                    }
                }
                
                console.log(`📦 [ActivityService] ${allActivities.length} tarefas reconstruídas de ${userInboxPath}`);
            }

            console.log(`🏁 [ActivityService] Total de atividades pré-cache: ${allActivities.length}`);

            // 2. Listar Snaps Ad Hoc (Pasta Compartilhada)
            const adhocPath = `shared/adhoc`;
            const { data: adhocFiles, error: adhocError } = await window.globalSupabaseClient
                .storage.from(BUCKET).list(adhocPath);

            if (!adhocError && adhocFiles) {
                console.log(`📦 [ActivityService] Encontrados ${adhocFiles.length} snaps adhoc`);
                for (const file of adhocFiles) {
                    // Verificação de permissão Ad Hoc
                    const formId = file.name.split('.')[0];
                    if (this.hasFormPermission(user, formId)) {
                        const snap = await this.downloadAndProcessSnap(`${adhocPath}/${file.name}`);
                        if (snap) allActivities.push(snap);
                    }
                }
            }

            // 2.1. Processar arquivos de limpeza de tarefas arquivadas/deletadas
            await this.processTaskCleanupFiles(userInboxPath);

            // 3. Cache base
            await this.cacheActivities(allActivities);
            
            // Retornar apenas tarefas ativas (não arquivadas e não concluídas localmente)
            const activeActivities = allActivities.filter(activity => {
                const task = activity.original_task || activity;
                const archived = task.arquivado === true || task.arquivado === 1 || task.arquivado === '1';
                const locallyCompleted = this._completedIds.has(task.id || activity.id);
                return !archived && !locallyCompleted;
            });
            
            return activeActivities;

        } catch (err) {
            console.error("❌ [ActivityService] Erro no fetchActivities (snaps):", err);
            return await this.getLocalActivities();
        }
    }

    /**
     * Auxiliar para baixar, descomprimir e construir atividade a partir de um Snap + Patches + WIP
     */
    async downloadAndProcessSnap(basePath, patchPaths = []) {
        try {
            console.log(`📡 [ActivityService] Reconstruindo tarefa: ${basePath}`);
            
            // 1. Baixar Snapshot Base
            const { data: baseBlob, error: baseError } = await window.globalSupabaseClient
                .storage.from('sync-bucket').download(basePath);
            
            if (baseError) throw baseError;

            const baseSnapshot = await this._parseSnapshotBlob(baseBlob);
            let task = baseSnapshot.data?.task || baseSnapshot.task;
            
            if (!task) {
                console.warn(`⚠️ [ActivityService] Snapshot base inválido em ${basePath}`);
                return null;
            }

            // 2. Aplicar Patches do Gerente
            for (const patchPath of patchPaths) {
                try {
                    console.log(`   🔸 Aplicando patch: ${patchPath}`);
                    const { data: patchBlob, error: patchError } = await window.globalSupabaseClient
                        .storage.from('sync-bucket').download(patchPath);
                    
                    if (!patchError) {
                        const patchData = JSON.parse(await patchBlob.text());
                        
                        // Merge gerencial (Patches podem alterar metadados e payload)
                        task = this._deepMerge(task, patchData);
                    }
                } catch (pe) {
                    console.error(`   ❌ Erro ao aplicar patch ${patchPath}:`, pe);
                }
            }

            // 3. Integrar WIP Local (Rascunhos no DataService)
            const activityId = task.id;
            if (window.dataService) {
                try {
                    // Buscar rascunhos vinculados a esta atividade
                    const drafts = await window.dataService.getFormDataByActivityId(activityId);
                    const activeDraft = drafts.find(d => d.syncStatus === 'draft');
                    
                    if (activeDraft && activeDraft.data) {
                        console.log(`   📝 Integrando WIP local do operador para tarefa ${activityId}`);
                        
                        // Merge com precedência para o operador
                        // NOTA: O payload da tarefa é mesclado com o data do rascunho
                        // Campos que o operador já preencheu no formulário vencem
                        const operatorData = activeDraft.data;
                        
                        // Garante que o payload do snapshot base seja o ponto de partida
                        const currentPayload = this.parseStructuredValue(task.payload, {});
                        const mergedPayload = this._deepMerge(currentPayload, operatorData);
                        
                        task.payload = mergedPayload;
                        task._has_local_wip = true; // Flag para UI
                    }
                } catch (de) {
                    console.warn(`   ⚠️ Erro ao buscar WIP local:`, de);
                }
            }

            // 4. Construir Atividade Final
            const activity = this.buildActivity(task);
            
            if (activity) {
                // Manter form schema original do snapshot base
                activity.form_schema = baseSnapshot.data?.form || baseSnapshot.form;
                activity.pre_load_data = baseSnapshot.data?.pre_load_data || baseSnapshot.pre_load_data;
                activity.is_adhoc = !!(baseSnapshot.data?.is_adhoc || baseSnapshot.is_adhoc);
                return activity;
            }
            return null;
        } catch (e) {
            console.error(`❌ [ActivityService] Erro reconstruindo ${basePath}:`, e);
            return null;
        }
    }

    /**
     * Helper para lidar com descompressão de blobs (.gz ou raw JSON)
     */
    async _parseSnapshotBlob(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Check for GZIP magic numbers (0x1f, 0x8b)
        const isGzip = uint8Array.length > 2 && uint8Array[0] === 0x1f && uint8Array[1] === 0x8b;
        
        let text;
        if (isGzip) {
            if (typeof pako !== 'undefined') {
                text = pako.ungzip(uint8Array, { to: 'string' });
            } else {
                console.warn(`⚠️ [ActivityService] Pako não disponível para descompressão`);
                text = new TextDecoder().decode(uint8Array);
            }
        } else {
            text = new TextDecoder().decode(uint8Array);
        }

        return JSON.parse(text);
    }

    async cacheActivities(activities) {
        console.log(`💾 [ActivityService] Cacheando ${activities?.length || 0} atividades no IndexedDB...`);

        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // Fase 5: Transação atômica — clear + puts na MESMA transação
            // Se falhar, o IndexedDB faz rollback automático (cache anterior preservado)
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
                activities.forEach(activity => {
                    store.put(activity);
                });
            };

            clearRequest.onerror = () => {
                console.error('❌ [ActivityService] Erro ao limpar cache antes de repovoar:', clearRequest.error);
                // Não rejeitar aqui; deixar transaction.onerror capturar
            };

            transaction.oncomplete = () => {
                console.log(`✅ [ActivityService] ${activities?.length || 0} atividades cacheadas com sucesso`);
                resolve();
            };

            transaction.onerror = (e) => {
                console.error('❌ [ActivityService] Erro ao cachear atividades (transação abortada):', e);
                reject(transaction.error || new Error('IndexedDB transaction failed'));
            };

            transaction.onabort = () => {
                console.warn('⚠️ [ActivityService] Transação de cache abortada — cache anterior preservado');
                reject(transaction.error || new Error('IndexedDB transaction aborted'));
            };
        });
    }

    async getLocalActivities() {
        console.log('📦 [ActivityService] Buscando atividades do cache local (modo offline/fallback)');

        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const activities = (request.result || [])
                    .map(activity => this.buildActivity(activity))
                    .filter(Boolean)
                    .filter(activity => {
                        const task = activity.original_task || activity;
                        const archived = task.arquivado === true || task.arquivado === 1 || task.arquivado === '1';
                        return !archived;
                    });
                console.log(`✅ [ActivityService] ${activities.length} atividades ativas encontradas no cache local`);
                resolve(activities);
            };

            request.onerror = () => {
                console.error('❌ [ActivityService] Erro ao buscar atividades do cache local:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * @deprecated ADR-056 V7 — Substituído por publishEvent('task.atualizada'/'task.concluida').
     * 
     * Uploads a task update snapshot to Inbox (legado — será removido)
     * @param {Object} taskData Partial task data to update
     */
    async uploadTaskUpdateSnapshot(taskData) {
        if (!window.globalSupabaseClient) return;

        const timestamp = new Date().getTime();
        const randomId = Math.random().toString(36).substring(7);
        const filename = `task_update_${taskData.id}_${timestamp}.json`;

        // Create snapshot structure matching what Desktop expects
        const snapshot = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            device_id: (typeof device !== 'undefined' && device.uuid) ? device.uuid : 'browser-mobile',
            origin_device: 'mobile',
            sync_type: 'incremental',
            data: {
                tarefas: [taskData] // Desktop pulls this and upserts
            },
            metadata: {
                checksum: '', // Optional/Can skip for simple updates
                record_count: { tarefas: 1, suite: 0 },
                compressed: false,
                file_size_bytes: 0
            }
        };

        const path = `shared/inbox/${filename}`;

        console.log(`📡 [ActivityService] Enviando update de tarefa para ${path}...`);

        const { error } = await window.globalSupabaseClient.storage
            .from('sync-bucket')
            .upload(path, JSON.stringify(snapshot), {
                contentType: 'application/json',
                upsert: false
            });

        if (error) {
            console.error(`❌ [ActivityService] Erro ao enviar update de tarefa:`, error);
        } else {
            console.log(`✅ [ActivityService] Update de tarefa enviado com sucesso!`);
        }
    }

    async startActivity(activityId) {
        console.log(`▶️ [ActivityService] Iniciando atividade (Tarefa): ${activityId}`);

        try {
            // Fetch first
            const activity = await this._get(activityId);
            if (!activity) {
                console.warn(`⚠️ [ActivityService] Atividade ${activityId} não encontrada`);
                return;
            }

            // Update local state
            activity.status = 'em_progresso';
            if (activity.original_task) activity.original_task.status = 'em_progresso';
            await this._put(activity);
            console.log(`✅ [ActivityService] Tarefa ${activityId} marcada como em_progresso no cache local`);

            // Publica evento task.atualizada via pipeline de sync
            if (window.syncAdapter?.isStarted()) {
                await window.syncAdapter.publishEvent('task.atualizada', {
                    tarefa_id: activityId,
                    status: 'em_progresso',
                    started_at: new Date().toISOString(),
                    started_by_device: 'mobile'
                }, {
                    aggregateType: 'task',
                    aggregateId: activityId,
                    streamId: activityId,
                });
                await window.syncAdapter.syncNow();
            } else {
                console.warn('⚠️ [ActivityService] SyncAdapter não iniciado — evento task.atualizada não publicado');
            }
        } catch (err) {
            console.error(`❌ [ActivityService] Erro ao iniciar atividade ${activityId}:`, err);
        }
    }

    async completeActivity(activityId, submissionId, activityData = null) {
        console.log(`✅ [ActivityService] Completando atividade (Tarefa): ${activityId}, submissionId: ${submissionId}`);
        if (!activityId) {
            console.error('❌ [ActivityService] activityId é obrigatório');
            throw new Error('activityId é obrigatório para completar atividade');
        }

        // Mark as completed immediately so fetchActivities filters it out
        // before the Desktop archives the Storage snapshot.
        this._completedIds.add(activityId);

        try {
            // 1. Fetch activity from local cache (use passed-in data as fallback to avoid cache-miss)
            const activity = activityData || await this._get(activityId);
            
            if (activity) {
                // 2. Publica evento task.concluida via pipeline de sync
                try {
                    if (window.syncAdapter?.isStarted()) {
                        await window.syncAdapter.publishEvent('task.concluida', {
                            tarefa_id: activityId,
                            status: 'concluido',
                            completed_at: new Date().toISOString(),
                            completed_by_device: 'mobile',
                            ...(submissionId ? { tbl_suite_id: submissionId } : {})
                        }, {
                            aggregateType: 'task',
                            aggregateId: activityId,
                            streamId: activityId,
                        });
                        await window.syncAdapter.syncNow();
                        console.log(`☁️ [ActivityService] Evento task.concluida publicado para Desktop`);
                    } else {
                        console.warn('⚠️ [ActivityService] SyncAdapter não iniciado — evento task.concluida não publicado');
                    }
                } catch (publishErr) {
                    console.warn('⚠️ [ActivityService] Erro ao publicar evento task.concluida:', publishErr);
                }

                // 4. Remove from local cache (completed) - This now runs in its own transaction
                await this._delete(activityId);
                console.log(`✅ [ActivityService] Tarefa ${activityId} removida do cache local (completada)`);
            } else {
                console.warn(`⚠️ [ActivityService] Atividade ${activityId} não encontrada no cache local para remoção`);
            }
        } catch (err) {
            console.error(`❌ [ActivityService] Falha ao completar atividade ${activityId}:`, err);
            throw err;
        }
    }

    /**
     * Fetches completed activities for the current user within the last N days.
     * Used to display history/archive view on mobile.
     * @param {number} daysBack - Number of days to look back (default 7)
     * @returns {Promise<Array>} List of completed activities
     */
    async getCompletedActivities(daysBack = 7) {
        console.log(`📜 [ActivityService] Buscando histórico de atividades (últimos ${daysBack} dias)...`);

        if (!window.globalSupabaseClient) {
            console.warn('⚠️ [ActivityService] Supabase não disponível para buscar histórico');
            return [];
        }

        try {
            // Download tasks.json from storage (same source as active tasks)
            const { data, error } = await window.globalSupabaseClient
                .storage
                .from('sync-bucket')
                .download('shared/tasks.json');

            if (error || !data) {
                console.warn('⚠️ [ActivityService] Erro ao baixar tasks.json para histórico:', error);
                return [];
            }

            const text = await data.text();
            const snapshot = JSON.parse(text);

            // Extract tasks array
            let allTasks = [];
            if (snapshot.data && (snapshot.data.tasks || snapshot.data.tarefas)) {
                allTasks = snapshot.data.tasks || snapshot.data.tarefas || [];
            } else if (snapshot.tasks) {
                allTasks = snapshot.tasks;
            } else if (Array.isArray(snapshot)) {
                allTasks = snapshot;
            }

            // Get current user
            const currentUser = window.authManager?.getCurrentUser();
            const userId = currentUser?.id;

            if (!userId) {
                console.warn('⚠️ [ActivityService] Usuário não logado para filtrar histórico');
                return [];
            }

            // Calculate the date threshold
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysBack);
            const cutoffISO = cutoffDate.toISOString();

            // Filter completed tasks for this user within the date range
            const completedTasks = allTasks.filter(task => {
                const isCompleted = task.status === 'concluido';
                const isAssignee = task.atribuido_para === userId;
                const updatedAt = task.updated_at || task.criado_em;
                const isRecent = updatedAt && updatedAt >= cutoffISO;
                return isCompleted && isAssignee && isRecent;
            });

            console.log(`✅ [ActivityService] Encontradas ${completedTasks.length} atividades concluídas no histórico`);

            // Map to the same format as active activities
            return completedTasks.map(task => this.buildActivity(task, {
                completedAt: task.updated_at
            })).filter(Boolean).sort((a, b) => {
                // Sort by completed date, most recent first
                return (b.completed_at || '').localeCompare(a.completed_at || '');
            });

        } catch (err) {
            console.error('❌ [ActivityService] Erro ao buscar histórico:', err);
            return [];
        }
    }

    async syncFromEvents() {
        try {
            const { openSyncEventDB } = await import('../sync/SyncEventDB.js');
            const syncDb = await openSyncEventDB();

            const tarefas = await new Promise((resolve, reject) => {
                const tx = syncDb.transaction('tarefas', 'readonly');
                const store = tx.objectStore('tarefas');
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });

            for (const tarefa of tarefas) {
                const existing = await this._get(tarefa.id);
                if (existing && existing.updated_at === tarefa.updated_at) continue;

                await this._put({
                    id: tarefa.id,
                    titulo: tarefa.titulo || 'Tarefa',
                    descricao: '',
                    status: this.normalizeStatus(tarefa.status),
                    prioridade: 'normal',
                    atribuido_para: null,
                    criado_por: null,
                    setor_id: null,
                    created_at: tarefa.criado_em,
                    updated_at: tarefa.updated_at || tarefa.criado_em,
                    payload: {},
                    tags: [],
                    source: 'event_pipeline',
                });
            }

            console.log(`[ActivityService] ${tarefas.length} tarefas sincronizadas do event pipeline`);
        } catch (err) {
            console.warn('[ActivityService] syncFromEvents falhou:', err);
        }
    }
}


window.activityService = new ActivityService();

