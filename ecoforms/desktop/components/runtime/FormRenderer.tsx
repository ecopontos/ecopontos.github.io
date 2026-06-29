"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import { FormContent, FormField } from "@/types";
import { FormFieldRenderer } from "./FormFieldRenderer";
import { uuidv7 } from 'ecoforms-core';
import type { FormFieldObjectValue, FormFieldValue } from "./FormFieldRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getContainerAsync } from "@/src/interface/hooks/catalog/utils";
import { isFieldEmpty } from "@/src/lib/utils";
import { useVisibilityEvaluator } from "@/src/interface/hooks/catalog/forms";
import { fetchFormMetadata, insertTarefaFromSolicitacao, insertPacoteFromForm } from "@/src/interface/hooks/queries/lookups";

interface FormRendererProps {
    content: FormContent;
    formType: string;
    prefillData?: Record<string, FormFieldValue>;
    readOnly?: boolean;
    customSubmit?: (data: Record<string, FormFieldValue>) => Promise<void>;
    submitLabel?: string;
}

type FormRecord = Record<string, FormFieldValue>;
type FormRegistryBooleanValue = string | number | boolean | null | undefined;

// Lógica inteligente para definir largura dos campos
function getFieldColSpan(field: FormField, globalColumns: number = 1): string {
    // 1. Se o formulário foi configurado para 1 coluna apenas, força largura total
    if (globalColumns === 1) return "md:col-span-12";

    // 2. Override manual no JSON do campo (ex: "layout": { "colSpan": 2 })
    if (field.config?.layout?.colSpan) {
        return field.config.layout.colSpan === 2 ? "md:col-span-12" : "md:col-span-6";
    }

    // 3. Tipos que PRECISAM de largura total para boa usabilidade
    const fullWidthTypes: readonly string[] = [
        // Geolocalização e mapas
        'gps',
        'geolocation',
        'map',

        // Captura de mídia
        'signature',
        'photo',
        'gallery',
        'file',
        'files',

        // Campos complexos
        'section_header',     // Títulos de seção
        'textarea',           // Textos longos
        'vistoria_checklist', // Checklist de vistoria
        'occupation',         // Campo de ocupação (matriz)
        'presence',           // Lista de presença
        'presence_list',      // Lista de presença (variante)
        'presence_compact',   // Lista de presença compacta
        'chips_multiple',     // Chips múltiplos (pode ter muitos itens)

        // Campos de dados estruturados
        'autocomplete',       // Autocomplete com lista longa
        'table',              // Tabelas
        'matrix',             // Campos matriz
    ] as const;

    const type = String(field.type || "").toLowerCase().trim();

    if (fullWidthTypes.includes(type)) {
        return "md:col-span-12";
    }

    // 4. Padrão: Ocupa metade da tela (permite 2 campos lado a lado)
    return "md:col-span-6";
}

export function FormRenderer({ content, formType, prefillData, readOnly = false, customSubmit, submitLabel }: FormRendererProps) {
    const router = useRouter();
    const { user } = useAuth();
    const initialData = useMemo(() => {
        const initial = { ...prefillData };
        if (content.campos) {
            content.campos.forEach((c) => {
                if (c.valor_padrao !== undefined && initial[c.id] === undefined) {
                    initial[c.id] = c.valor_padrao;
                }
            });
        }
        return initial;
    }, [prefillData, content.campos]);

    // Initialize state only once with prefillData if available (or empty object)
    const [formData, setFormData] = useState<FormRecord>(initialData);
    const [submitting, setSubmitting] = useState(false);

    // Hook para avaliar visibilidade condicional
    const { isFieldVisible, isFieldEnabled, visibleFields } = useVisibilityEvaluator(formData);

    // Filtrar apenas campos visíveis (memoizado para performance)
    const displayedFields = useMemo(() => {
        return visibleFields(content.campos || []);
    }, [content.campos, visibleFields]);

    useEffect(() => {
        if (prefillData) {
            console.log("DEBUG: FormRenderer received new prefillData", prefillData);
            const merged = { ...prefillData };
            content.campos?.forEach((c) => {
                if (c.valor_padrao !== undefined && merged[c.id] === undefined) {
                    merged[c.id] = c.valor_padrao;
                }
            });
            setFormData(merged);
        }
    }, [prefillData, content.campos]);

    const handleFieldChange = useCallback((fieldId: string, value: FormFieldValue) => {
        setFormData((prev) => {
            // Optimization: prevent update if value is same (avoids infinite loops)
            if (prev[fieldId] === value) return prev;
            // Also deep check if object? For now shallow reference check is good for primitives
            // If value is object (like file), reference change is expected
            return {
                ...prev,
                [fieldId]: value,
            };
        });
    }, []);

    // uploadFiles removed (Supabase)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Validação de campos obrigatórios usando lógica robusta
            // Ignorar campos invisíveis (condicionalidade)
            for (const field of displayedFields) {
                if (field.required && isFieldEmpty(formData[field.id])) {
                    alert(`O campo "${field.label}" é obrigatório.`);
                    setSubmitting(false);
                    return;
                }
            }

            // Stamp timestamp/defaultToNow fields with the actual submission time.
            // Done here (not at form load) so the saved value reflects when the form was *sent*.
            const submitTimestamp = new Date().toISOString();
            const stampedData = { ...formData };
            for (const field of content.campos || []) {
                if (field.type === 'timestamp' || field.defaultToNow) {
                    stampedData[field.id] = submitTimestamp;
                }
            }

            if (customSubmit) {
                await customSubmit(stampedData);
            } else {
                if (!user) {
                    alert("Você precisa estar logado para enviar este formulário.");
                    setSubmitting(false);
                    return;
                }

                // Force Local Save (Offline Logic)
                try {
                    console.log('💾 Salvando localmente (SQLite)...');

                    // 1. Process images for OPFS (Local File System)
                    const { OfflineStorageService } = await import('@/lib/offline-storage');
                    const offlineService = OfflineStorageService.getInstance();

                    const processOfflineValue = async (value: FormFieldValue): Promise<FormFieldValue> => {
                        if (!value) return value;
                        if (Array.isArray(value)) {
                            return await Promise.all(value.map(processOfflineValue));
                        }
                        if (typeof value === 'object') {
                            if (value instanceof File) {
                                // saveFile returns path string
                                const path = await offlineService.saveFile(value, user.id);
                                return {
                                    offline_path: path,
                                    name: value.name,
                                    type: value.type,
                                    size: value.size,
                                    offline: true
                                };
                            }
                            if (value.file instanceof File) {
                                // Similar logic for wrapped file
                                const path = await offlineService.saveFile(value.file, user.id);
                                const meta = {
                                    offline_path: path,
                                    name: value.file.name,
                                    type: value.file.type,
                                    size: value.file.size,
                                    offline: true
                                };
                                if ('uri' in value) {
                                    // Create temp URL for session if needed
                                    const url = URL.createObjectURL(value.file);
                                    return { ...value, ...meta, uri: url, file: undefined };
                                }
                                return { ...value, ...meta, file: undefined };
                            }
                            const newObj: FormFieldObjectValue = {};
                            for (const k in value) {
                                newObj[k] = await processOfflineValue(value[k]);
                            }
                            return newObj;
                        }
                        return value;
                    };

                    const offlineData = { ...stampedData };
                    for (const key of Object.keys(offlineData)) {
                        offlineData[key] = await processOfflineValue(offlineData[key]);
                    }

                    // 2. Prepare payload for local DB
                    const dadosOrganizados = {
                        contexto: {
                            form_id: formType,
                            form_titulo: content.titulo || null,
                            data_registro: new Date().toISOString().split('T')[0],
                            hora_registro: new Date().toTimeString().split(' ')[0].substring(0, 5),
                            timestamp: new Date().toISOString(),
                            device_id: user.setores?.[0] || user.id,
                            usuario_nome: user.nome || user.username || user.id
                        },
                        campos: offlineData,
                        arquivos: {}
                    };

                    // Auto-aprovação é definida por formulário em form_registry.
                    // Quando habilitada, o registro já nasce aprovado localmente.
                    let autoAprovacaoAtiva = false;
                    let isAdHocForm = false;
                    const db = await getContainerAsync();
                    const formMetadata = await fetchFormMetadata<FormRegistryBooleanValue>(formType);

                    if (formMetadata) {
                        const row = formMetadata;
                        // Fix #12: lógica de coerção booleana unificada para ambos os campos,
                        // cobrindo as variantes que SQLite pode retornar (int 0/1, string, boolean)
                        const isTruthy = (v: FormRegistryBooleanValue) =>
                            v === 1 || v === true || v === '1' || v === 'true' || v === 'TRUE' ||
                            (typeof v === 'number' && v > 0);
                        autoAprovacaoAtiva = isTruthy(row.auto_aprovacao);
                        isAdHocForm = isTruthy(row.ad_hoc);
                    }

                    // Detecta se é uma solicitação (campo oculto tipo_submissao=SOLICITACAO)
                    const isSolicitacao = Object.values(offlineData).some(
                        v => typeof v === 'string' && v.toUpperCase() === 'SOLICITACAO'
                    );

                    const now = new Date().toISOString();
                    let payloadJson: string;
                    try {
                        payloadJson = JSON.stringify(dadosOrganizados) ?? '{}';
                    } catch {
                        payloadJson = JSON.stringify({ error: 'serialization_failed', form_id: formType, timestamp: now });
                    }

                    if (isSolicitacao) {
                        // Solicitação → tarefa direta com status aguardando_aprovacao
                        const taskId = uuidv7();
                        const tituloSolicitacao = typeof offlineData.titulo === 'string' && offlineData.titulo
                            ? offlineData.titulo
                            : content.titulo || 'Nova Solicitação';
                        const descricaoSolicitacao = typeof offlineData.descricao === 'string' ? offlineData.descricao : null;
                        const prioridadeSolicitacao = ['baixa', 'media', 'alta'].includes(String(offlineData.prioridade))
                            ? String(offlineData.prioridade)
                            : 'media';

                        await insertTarefaFromSolicitacao({
                            id: taskId,
                            titulo: tituloSolicitacao,
                            descricao: descricaoSolicitacao ?? '',
                            prioridade: prioridadeSolicitacao,
                            criado_por: user.id,
                            id_formulario: formType,
                            carga: payloadJson,
                        });
                    } else {
                        // Formulário regular → pacote v2
                        const packageId = uuidv7().replace(/-/g, '');
                        const statusInicial = autoAprovacaoAtiva ? 'current' : 'draft';
                        const pacote = {
                            envelope: {
                                package_id: packageId,
                                version_no: 1,
                                module_type: 'form',
                                resource_type: formType,
                                status: statusInicial,
                                owner_id: user.id,
                            },
                            payload: dadosOrganizados,
                            meta: {
                                form_id: formType,
                                form_titulo: content.titulo ?? null,
                                device_id: user.setores?.[0] || user.id,
                                criador: user.nome || user.username || user.id,
                                sync_timestamp: null,
                                checksum: null,
                            }
                        };
                        let pacoteJson: string;
                        try {
                            pacoteJson = JSON.stringify(pacote) ?? '{}';
                        } catch {
                            pacoteJson = JSON.stringify({ error: 'serialization_failed', form_id: formType, timestamp: now });
                        }
                        await insertPacoteFromForm({
                            id_pacote: packageId,
                            tipo_modulo: formType,
                            tipo_recurso: formType,
                            status: statusInicial,
                            id_proprietario: user.id,
                            dados: pacoteJson,
                            carga_json: pacoteJson,
                            criado_em: now,
                        });
                    }

                    // Write-back to Data Registry if any field has registryWriteback config
                    for (const field of content.campos || []) {
                        const wb = field.config?.registryWriteback;
                        if (wb && wb.tipo) {
                            try {
                                const { SubmitToRegistryUseCase } = await import('@/src/application/data-registry/SubmitToRegistryUseCase');
                                const useCase = new SubmitToRegistryUseCase(db.dataRegistryRepository, db.clock);
                                const keyField = wb.keyField;
                                const entryKey = keyField && typeof offlineData[keyField] === 'string'
                                    ? String(offlineData[keyField])
                                    : undefined;
                                await useCase.execute({
                                    tipo: wb.tipo,
                                    formData: offlineData,
                                    mappings: wb.mappings,
                                    entryKey,
                                });
                            } catch (wbErr) {
                                console.error('[FormRenderer] Registry write-back failed for field', field.id, wbErr);
                            }
                        }
                    }

                    // 4. Sucesso
                    console.log(`[FormRenderer] Ad-hoc form check - isAdHocForm:`, isAdHocForm);

                    alert("Formulário salvo com sucesso!");

                    router.push("/");
                    return;

                } catch (offErr: unknown) {
                    console.error("Erro ao salvar:", offErr);
                    const errMsg = offErr instanceof Error ? offErr.message : String(offErr);
                    alert("Erro ao salvar: " + errMsg);
                    setSubmitting(false);
                    return;
                }
            }
        } catch (error: unknown) {
            console.error("Erro ao enviar:", error);
            alert("Erro ao enviar: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setSubmitting(false);
        }
    };

    // Define quantas colunas usar (padrão do JSON ou fallback para 1)
    const globalCols = content.layout?.columns || 1;

    return (
        <Card className="w-full max-w-6xl mx-auto">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>{content.titulo || "Formulário Sem Título"}</CardTitle>
                        <CardDescription>Preencha os dados abaixo.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* GRID SYSTEM: Aqui está a mágica do layout */}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {displayedFields.map((field) => (
                        <div
                            key={field.id}
                            className={`col-span-1 ${getFieldColSpan(field, globalCols)}`}
                        >
                            <FormFieldRenderer
                                field={field}
                                value={formData[field.id]}
                                onChange={readOnly ? () => { } : (val) => handleFieldChange(field.id, val)}
                                readOnly={readOnly || !isFieldEnabled(field)}
                                formData={formData}
                            />
                        </div>
                    ))}

                    {!readOnly && (
                        <div className="col-span-1 md:col-span-12 pt-4 flex justify-end">
                            <Button type="submit" disabled={submitting}>
                                <Send className="mr-2 h-4 w-4" />
                                {submitting ? "Salvando..." : 
                                 (submitLabel || "Enviar Formulário")}
                            </Button>
                        </div>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}
