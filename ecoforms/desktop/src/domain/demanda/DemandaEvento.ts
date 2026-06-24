export interface DemandaEvento {
  id: string;
  demandaId: string;
  type: string;
  correlationId: string | null;
  causationId: string | null;
  payload: Record<string, unknown>;
  deviceId: string | null;
  userId: string | null;
  createdAt: string;
}
