import type { Setor } from './Setor';

export interface SetorRepository {
  findAll(): Promise<Setor[]>;
  findAtivos(): Promise<Setor[]>;
  findById(id: string): Promise<Setor | null>;
  create(id: string, nome: string, descricao?: string | null): Promise<void>;
  update(id: string, nome: string, descricao?: string | null): Promise<void>;
  remove(id: string): Promise<void>;
}
