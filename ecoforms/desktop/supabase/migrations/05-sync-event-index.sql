-- ============================================================
-- EcoForms — sync_event_index (ADR-056 §8)
-- Substitui Manifest + .enc Storage como transporte do Tier A.
--
-- Tabela canônica do event log + 2 RPCs SECURITY DEFINER que dão a
-- `anon` (mobile) e `authenticated` (desktop) acesso de push/pull
-- sem grants diretos na tabela.
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_event_index (
    id              UUID PRIMARY KEY,
    org_id          TEXT NOT NULL DEFAULT 'ecoforms-org-001',
    routing_id      TEXT NOT NULL,
    routing_type    TEXT NOT NULL,
    seq             BIGINT NOT NULL,
    event_type      TEXT NOT NULL,
    aggregate_type  TEXT,
    aggregate_id    TEXT,
    device_id       TEXT NOT NULL,
    checksum        TEXT NOT NULL,
    prev_event_id   UUID,
    payload_enc     BYTEA NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (routing_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_sync_event_index_routing_seq
    ON sync_event_index (routing_id, seq);

-- RLS habilitada sem policies + zero grants diretos: a tabela fica
-- inacessível via PostgREST (/rest/v1/sync_event_index) para anon e
-- authenticated. Todo acesso é exclusivamente via as RPCs abaixo, que
-- rodam como o owner da tabela (SECURITY DEFINER) e por isso ignoram RLS.
--
-- Sem isolamento por org_id por enquanto: o mobile chama essas RPCs como
-- `anon` sem sessão Supabase Auth (sem auth.uid()), então uma policy
-- org_id = auth.jwt()... não seria avaliável para o mobile. EcoForms é
-- single-org hoje (org_id default 'ecoforms-org-001' em todo o schema).
-- A coluna org_id fica disponível para uma policy multi-tenant futura
-- quando o mobile tiver autenticação real por dispositivo/org.
ALTER TABLE sync_event_index ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sync_event_index FROM anon, authenticated;

-- ── rpc_push_sync_event ─────────────────────────────────────
-- Atribui seq sequencial por routing_id (retry em unique_violation).
-- Idempotente por id (envelope.id): se já existe, retorna o seq existente.
CREATE OR REPLACE FUNCTION rpc_push_sync_event(
    p_id             UUID,
    p_routing_id     TEXT,
    p_routing_type   TEXT,
    p_event_type     TEXT,
    p_aggregate_type TEXT,
    p_aggregate_id   TEXT,
    p_device_id      TEXT,
    p_checksum       TEXT,
    p_prev_event_id  UUID,
    p_payload_enc    BYTEA
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seq     BIGINT;
    v_attempt INT := 0;
BEGIN
    SELECT seq INTO v_seq FROM sync_event_index WHERE id = p_id;
    IF v_seq IS NOT NULL THEN
        RETURN v_seq;
    END IF;

    LOOP
        v_attempt := v_attempt + 1;
        SELECT COALESCE(MAX(seq), 0) + 1 INTO v_seq
            FROM sync_event_index WHERE routing_id = p_routing_id;

        BEGIN
            INSERT INTO sync_event_index (
                id, routing_id, routing_type, seq, event_type,
                aggregate_type, aggregate_id, device_id, checksum,
                prev_event_id, payload_enc
            ) VALUES (
                p_id, p_routing_id, p_routing_type, v_seq, p_event_type,
                p_aggregate_type, p_aggregate_id, p_device_id, p_checksum,
                p_prev_event_id, p_payload_enc
            );
            RETURN v_seq;
        EXCEPTION WHEN unique_violation THEN
            IF v_attempt >= 20 THEN
                RAISE EXCEPTION 'rpc_push_sync_event: too many retries for routing_id=%', p_routing_id;
            END IF;
            -- volta ao loop e tenta o próximo seq
        END;
    END LOOP;
END;
$$;

-- ── rpc_pull_sync_events ─────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_pull_sync_events(
    p_routing_id TEXT,
    p_since_seq  BIGINT,
    p_limit      INT DEFAULT 50
) RETURNS TABLE (
    id             UUID,
    routing_id     TEXT,
    routing_type   TEXT,
    seq            BIGINT,
    event_type     TEXT,
    aggregate_type TEXT,
    aggregate_id   TEXT,
    device_id      TEXT,
    checksum       TEXT,
    prev_event_id  UUID,
    payload_enc    BYTEA,
    created_at     TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, routing_id, routing_type, seq, event_type, aggregate_type,
           aggregate_id, device_id, checksum, prev_event_id, payload_enc, created_at
    FROM sync_event_index
    WHERE routing_id = p_routing_id AND seq > p_since_seq
    ORDER BY seq ASC
    LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION rpc_push_sync_event(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BYTEA
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION rpc_pull_sync_events(TEXT, BIGINT, INT) TO anon, authenticated;
