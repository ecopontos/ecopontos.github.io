export interface TaskCriadaPayload {
    id:             string;
    titulo:         string;
    descricao:      string | null;
    status:         'a_fazer';
    prioridade:     'baixa' | 'media' | 'alta';
    setor_id:       string | null;
    atribuido_para: string | null;
    prazo:          string | null;
    criado_por:     string;
    criado_em:      string;
    origem_tipo:    'demanda' | 'agendamento' | 'manifestacao' | 'suite' | 'manual';
    origem_id:      string | null;
    formularios:    Array<{
        formRegistryId: string;
        ordem:          number;
        obrigatorio:    boolean;
    }>;
}
