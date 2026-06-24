import { useState, useCallback } from 'react';
import { useContainer } from '../utils/useContainer';
import type { Demanda, DemandaStatus } from '../../../domain/demanda/Demanda';
import type { DemandaListFilters, DemandaListItem } from '../../../domain/demanda/DemandaRepository';
import type { DemandaStatusResult } from '../../../application/demanda/GetDemandaStatusUseCase';
import type { CreateDemandaInput } from '../../../application/demanda/CreateDemandaUseCase';
import type { AcceptDemandaInput } from '../../../application/demanda/AcceptDemandaUseCase';
import type { CloseDemandaInput } from '../../../application/demanda/CloseDemandaUseCase';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}

export function useDemandas() {
  const container = useContainer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDemanda = useCallback(async (input: CreateDemandaInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await container.demandas.create.execute(input);
      return result;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [container]);

  const acceptDemanda = useCallback(async (input: AcceptDemandaInput) => {
    setLoading(true);
    setError(null);
    try {
      await container.demandas.accept.execute(input);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [container]);

  const closeDemanda = useCallback(async (input: CloseDemandaInput) => {
    setLoading(true);
    setError(null);
    try {
      await container.demandas.close.execute(input);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [container]);

  const getDemandaStatus = useCallback(async (demandaId: string): Promise<DemandaStatusResult> => {
    setLoading(true);
    setError(null);
    try {
      return await container.demandas.getStatus.execute(demandaId);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [container]);

  const listDemandasByStatus = useCallback(async (status: DemandaStatus): Promise<Demanda[]> => {
    setLoading(true);
    setError(null);
    try {
      return await container.demandaRepository.findByStatus(status);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [container]);

  const listDemandasWithDetails = useCallback(async (filters: DemandaListFilters = {}): Promise<DemandaListItem[]> => {
    setLoading(true);
    setError(null);
    try {
      return await container.demandaRepository.findAllWithDetails(filters);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [container]);

  return {
    createDemanda,
    acceptDemanda,
    closeDemanda,
    getDemandaStatus,
    listDemandasByStatus,
    listDemandasWithDetails,
    loading,
    error
  };
}
