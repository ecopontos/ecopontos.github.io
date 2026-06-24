/**
 * useSolicitacaoEditor
 *
 * Objetivo:
 *   Gerencia o fluxo de edição e re-submissão de um pacote (contrato v2).
 *   Abre o formulário original com o payload existente, permite alteração e cria uma nova
 *   versão do pacote com status 'current', marcando a versão anterior como is_current = 0.
 *
 *   Regra v2: NUNCA usa UPDATE em suite — sempre INSERT de nova versão.
 */
import { useState } from "react"
import { getContainerAsync } from "@/src/infrastructure/container";
import type { SolicitacaoPackage } from "../queries/useSolicitacoesList"

export function useSolicitacaoEditor(userId: string | undefined) {
    const [selectedPackage, setSelectedPackage] = useState<SolicitacaoPackage | null>(null)
    const [editingPayload, setEditingPayload] = useState<Record<string, unknown> | null>(null)
    const [editingFormDefinition, setEditingFormDefinition] = useState<Record<string, unknown> | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const openEditor = async (pkg: SolicitacaoPackage): Promise<boolean> => {
        try {
            setSelectedPackage(pkg)

            const payload = typeof pkg.carga_json === 'string'
                ? JSON.parse(pkg.carga_json)
                : pkg.carga_json
            setEditingPayload(payload)

            const formId: string | undefined =
                payload?.envelope?.form_id ??
                payload?.meta?.form_id ??
                pkg.tipo_recurso

            if (!formId) return true

            const container = await getContainerAsync();
            const definition = await container.suites.getFormDefinition.execute(formId);
            setEditingFormDefinition(definition as Record<string, unknown> | null);
            return definition !== null;
        } catch (error) {
            console.error("Erro ao abrir edição:", error)
            return false
        }
    }

    const saveResubmission = async (): Promise<boolean> => {
        if (!selectedPackage || !editingPayload) return false
        try {
            setIsSaving(true)
            const container = await getContainerAsync();
            await container.suites.resubmit.execute({
                packageId: selectedPackage.id_pacote,
                moduleType: selectedPackage.tipo_modulo ?? '',
                resourceType: selectedPackage.tipo_recurso,
                versionNo: selectedPackage.num_versao ?? 1,
                status: selectedPackage.status,
                newPayload: JSON.stringify(editingPayload),
                userId,
            });
            return true
        } catch (error) {
            console.error("Erro ao re-enviar solicitação:", error)
            return false
        } finally {
            setIsSaving(false)
        }
    }

    return {
        selectedPackage,
        setSelectedPackage,
        editingPayload,
        setEditingPayload,
        editingFormDefinition,
        isSaving,
        openEditor,
        saveResubmission,
        selectedSolicitacao: selectedPackage,
        setSelectedSolicitacao: setSelectedPackage,
        editingFormData: editingPayload,
        setEditingFormData: setEditingPayload,
    }
}
