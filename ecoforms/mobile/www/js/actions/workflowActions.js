/**
 * Mobile workflow actions — registra as 7 acoes canonicas (AD-016) no ActionRegistry mobile.
 *
 * No mobile, acoes de workflow publicam eventos via SyncAdapter/SyncEventDB.
 * As mudancas efetivas no banco local ocorrem via HandlerRegistry inbound.
 */
import { registerAction } from './ActionRegistry.js';

function getStreamId(ctx) {
  return ctx.formData?.demanda_id || ctx.suitePackage?.demanda_id || undefined;
}

export function registerMobileWorkflowActions() {
  // ACEITAR — terminal, locked
  registerAction({
    id: 'aceitar',
    label: 'Aceitar',
    icon: 'check-circle',
    color: 'green',
    enabledWhen: [
      { fieldId: 'status', operator: 'eq', value: 'pending_review' },
    ],
    requiredRoles: ['admin', 'gerente', 'coordenador'],
    handler: async (ctx) => {
      const streamId = getStreamId(ctx);
      await window.syncAdapter.publishEvent('suite.aprovada', {
        packageId: ctx.targetId,
        aceitoPor: ctx.userId,
      }, { streamId });
      await window.syncAdapter.syncNow();
      return { success: true, message: 'Aceito com sucesso' };
    },
  });

  // REJEITAR — terminal, closed
  registerAction({
    id: 'rejeitar',
    label: 'Rejeitar',
    icon: 'x-circle',
    color: 'red',
    enabledWhen: [
      { fieldId: 'status', operator: 'eq', value: 'pending_review' },
    ],
    requiredRoles: ['admin', 'gerente', 'coordenador'],
    handler: async (ctx) => {
      const streamId = getStreamId(ctx);
      await window.syncAdapter.publishEvent('suite.rejeitada', {
        packageId: ctx.targetId,
        rejeitadoPor: ctx.userId,
      }, { streamId });
      await window.syncAdapter.syncNow();
      return { success: true, message: 'Rejeitado com sucesso' };
    },
  });

  // DEVOLVER — terminal, refuted
  registerAction({
    id: 'devolver',
    label: 'Devolver',
    icon: 'rotate-ccw',
    color: 'orange',
    enabledWhen: [
      { fieldId: 'status', operator: 'neq', value: 'refuted' },
      { fieldId: 'status', operator: 'neq', value: 'locked' },
    ],
    requiredRoles: ['admin', 'gerente', 'coordenador'],
    handler: async (ctx) => {
      const streamId = getStreamId(ctx);
      await window.syncAdapter.publishEvent('suite.devolvida', {
        packageId: ctx.targetId,
        devolvidoPor: ctx.userId,
      }, { streamId });
      await window.syncAdapter.syncNow();
      return { success: true, message: 'Devolvido com sucesso' };
    },
  });

  // REENCAMINHAR — generator, dispatched+transfer (origem perde propriedade)
  registerAction({
    id: 'reencaminhar',
    label: 'Reencaminhar',
    icon: 'arrow-right-left',
    color: 'amber',
    confirmationRequired: true,
    confirmationMessage: 'Reencaminhar transfere a propriedade total para o setor destino.',
    enabledWhen: [
      { fieldId: 'status', operator: 'neq', value: 'concluido' },
      { fieldId: 'status', operator: 'neq', value: 'cancelado' },
      { fieldId: 'status', operator: 'neq', value: 'closed' },
    ],
    requiredRoles: ['admin', 'gerente', 'coordenador'],
    requiresInput: {
      fields: [
        {
          id: 'destinatarioId',
          label: 'Setor destino',
          type: 'select',
          required: true,
          options: [
            { value: 'setor-admin', label: 'Administracao Geral' },
            { value: 'setor-ambiente', label: 'Meio Ambiente' },
            { value: 'setor-coleta', label: 'Coleta de Residuos' },
            { value: 'setor-fiscalizacao', label: 'Fiscalizacao Ambiental' },
          ],
        },
        {
          id: 'motivo',
          label: 'Motivo da transferencia',
          type: 'text',
          required: true,
        },
      ],
    },
    handler: async (ctx) => {
      const destinatarioId = ctx.input?.destinatarioId;
      const motivo = ctx.input?.motivo;
      if (!destinatarioId || !motivo) {
        return { success: false, message: 'Preencha todos os campos obrigatorios.' };
      }
      const streamId = getStreamId(ctx);
      await window.syncAdapter.publishEvent('suite.reencaminhada', {
        packageId: ctx.targetId,
        destinatarioId,
        reencaminhadoPor: ctx.userId,
        motivo,
      }, { streamId });
      await window.syncAdapter.syncNow();
      return { success: true, message: `Propriedade transferida para ${destinatarioId}.` };
    },
  });

  // ENCAMINHAR — generator, dispatched+share (origem mantem)
  registerAction({
    id: 'encaminhar',
    label: 'Encaminhar',
    icon: 'forward',
    color: 'blue',
    enabledWhen: [
      { fieldId: 'status', operator: 'neq', value: 'concluido' },
      { fieldId: 'status', operator: 'neq', value: 'cancelado' },
    ],
    requiredRoles: ['admin', 'gerente', 'coordenador', 'operador'],
    requiresInput: {
      fields: [
        {
          id: 'destinatarioId',
          label: 'Setor destino',
          type: 'select',
          required: true,
          options: [
            { value: 'setor-admin', label: 'Administracao Geral' },
            { value: 'setor-ambiente', label: 'Meio Ambiente' },
            { value: 'setor-coleta', label: 'Coleta de Residuos' },
            { value: 'setor-fiscalizacao', label: 'Fiscalizacao Ambiental' },
          ],
        },
        {
          id: 'motivo',
          label: 'Motivo',
          type: 'text',
          required: true,
        },
      ],
    },
    handler: async (ctx) => {
      const destinatarioId = ctx.input?.destinatarioId;
      const motivo = ctx.input?.motivo;
      if (!destinatarioId || !motivo) {
        return { success: false, message: 'Preencha todos os campos obrigatorios.' };
      }
      await window.syncAdapter.publishEvent('demanda.criada', {
        origemTipo: 'encaminhamento',
        origemId: ctx.targetId,
        solicitanteId: ctx.userId,
        destinatarioId,
        tipoAcao: 'compartilhamento',
        descricao: motivo,
      }, { streamId: ctx.targetId });
      await window.syncAdapter.syncNow();
      return { success: true, message: `Encaminhado para ${destinatarioId}.` };
    },
  });

  // SOLICITAR — generator, current (gera derivado)
  registerAction({
    id: 'solicitar',
    label: 'Solicitar',
    icon: 'file-plus',
    color: 'blue',
    enabledWhen: [
      { fieldId: 'status', operator: 'neq', value: 'locked' },
      { fieldId: 'status', operator: 'neq', value: 'closed' },
    ],
    requiredRoles: ['admin', 'gerente', 'coordenador', 'operador'],
    handler: async (ctx) => {
      const streamId = getStreamId(ctx);
      await window.syncAdapter.publishEvent('suite.solicitada', {
        origemId: ctx.targetId,
        solicitadoPor: ctx.userId,
      }, { streamId });
      await window.syncAdapter.syncNow();
      return { success: true, message: 'Solicitacao criada com sucesso' };
    },
  });

  // CRIAR_TAREFA — generator, current (gera tarefa)
  registerAction({
    id: 'criar_tarefa',
    label: 'Criar Tarefa',
    icon: 'clipboard-list',
    color: 'purple',
    enabledWhen: [
      { fieldId: 'status', operator: 'neq', value: 'locked' },
    ],
    requiredRoles: ['admin', 'gerente', 'coordenador', 'encarregado'],
    handler: async (ctx) => {
      await window.syncAdapter.publishEvent('task.criada', {
        demandaId: ctx.targetId,
        criadoPor: ctx.userId,
      }, {
        aggregateType: 'task',
        aggregateId: ctx.targetId,
        streamId: ctx.targetId,
      });
      await window.syncAdapter.syncNow();
      return { success: true, message: 'Tarefa criada com sucesso' };
    },
  });
}