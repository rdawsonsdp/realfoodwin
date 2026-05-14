-- =========================================================================
-- 0001_extensions.sql
-- Required Postgres extensions for Real Food Win V2.
--
-- Idempotent: safe to re-run. Supabase provisions extensions into the
-- `extensions` schema by convention; `create extension if not exists`
-- respects whatever schema the extension is already installed into.
-- =========================================================================

-- pgvector: stores Voyage AI embeddings (vector(1024) for voyage-3).
-- Used by `embeddings` and `user_summaries` for RAG retrieval.
create extension if not exists vector;

-- pgcrypto: provides gen_random_uuid(), used as the default value for every
-- uuid PK in this schema. Preferred over uuid-ossp on modern Postgres
-- (it ships in core and only needs `create extension`).
create extension if not exists pgcrypto;
