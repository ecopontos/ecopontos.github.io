import type { ExecucaoCliente } from './ExecucaoCliente';

export interface ExecucaoClienteRepository {
    findAll(): Promise<ExecucaoCliente[]>;
    findByExecucao(execucaoId: string): Promise<ExecucaoCliente[]>;
    findByCliente(clienteId: string): Promise<ExecucaoCliente[]>;
    findById(id: string): Promise<ExecucaoCliente | null>;
    save(execucao: ExecucaoCliente): Promise<void>;
    delete(id: string): Promise<void>;
}
