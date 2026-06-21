-- ============================================================
-- Coaching Module: Assistant chat + optional pgvector (Phase H)
-- Migration: 028_coaching_embeddings.sql
-- IDEMPOTENT. Skips vector tables when pgvector is not installed.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.assistant_message (
  id              BIGSERIAL PRIMARY KEY,
  facility_id     BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  member_id       BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  coach_user_id   BIGINT NOT NULL REFERENCES public.app_user(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_assistant_message_thread
  ON coaching.assistant_message(facility_id, member_id, coach_user_id, created_at);

DO $pgvector$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    RAISE NOTICE 'pgvector not available — embedding_chunk table skipped';
    RETURN;
  END IF;

  EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';

  EXECUTE $sql$
    CREATE TABLE IF NOT EXISTS coaching.embedding_chunk (
      id           BIGSERIAL PRIMARY KEY,
      facility_id  BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
      member_id    BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
      source_type  TEXT NOT NULL,
      source_id    BIGINT,
      content      TEXT NOT NULL,
      embedding    vector(1536),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  $sql$;

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_coaching_embedding_chunk_facility_member ON coaching.embedding_chunk(facility_id, member_id)';

  EXECUTE $sql$
    CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_embedding_chunk_source
      ON coaching.embedding_chunk(facility_id, member_id, source_type, source_id)
      WHERE source_id IS NOT NULL
  $sql$;

  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_coaching_embedding_chunk_vector ON coaching.embedding_chunk USING hnsw (embedding vector_cosine_ops)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'HNSW index skipped: %', SQLERRM;
  END;
END $pgvector$;
