# AI & Vector Search — Architecture Guide

Companion to [COACHING_CORNER_ROADMAP.md](COACHING_CORNER_ROADMAP.md) Phase H. Documents how Vortex
integrates LLMs today and how to add **retrieval** (vector search) when the coaching assistant
needs grounded context.

---

## Current LLM stack (implemented)

| Piece | Location | Notes |
|-------|----------|-------|
| Vercel AI SDK | `backend/platform/aiService.js` | `generateText` via `@ai-sdk/openai` |
| Progress narrative | `POST /api/coach/ai/progress-narrative/:memberId` | LLM when `OPENAI_API_KEY` set; rule fallback |
| PDF reports | `GET /api/coach/ai/progress-report/:memberId/pdf` | `pdfkit` server PDF (narrative + PRs + goals) |
| Audit trail | `coaching.ai_draft_log` | All AI outputs logged with `narrativeSource: llm \| rules` |

**Env vars** (`backend/env.example`):

- `OPENAI_API_KEY` — required for LLM paths
- `OPENAI_MODEL` — optional, default `gpt-4o-mini` (cheap, fast, good for narratives)

Deterministic paths (`/prescribe`, NL-needs parsing rules, autotag heuristics) remain the
**executor of record**; the LLM proposes text, the schema and engines dispose.

---

## Do you need a vector database?

**Probably yes for Phase H “conversational assistant grounded in athlete history”** — but the
corpus per facility is **small** (hundreds of exercises, dozens of athletes, thousands of log
rows). You do **not** need a separate heavy vector SaaS unless you scale to multi-facility
search across huge libraries.

### Recommended path: **pgvector in existing Postgres**

| Why | Detail |
|-----|--------|
| Same DB | No new vendor; joins with `member`, `completion_log`, `exercise` |
| Small scale | `< 100k` chunks is trivial for pgvector IVFFlat/HNSW |
| Tenancy | Filter `WHERE facility_id = $1` on every query |
| Ops | One backup, one migration path (`initPlatformTables`) |

**When to consider Pinecone / Turbopuffer / etc.** — millions of chunks, cross-facility
marketplace search, or dedicated ML team managing embeddings at scale.

---

## What to embed (coaching corpus)

Chunk and embed **retrieval units** with metadata:

| Source | Chunk | Metadata |
|--------|-------|----------|
| `coaching.exercise` | name + description + cues | `facility_id`, `exercise_id`, sport |
| `coaching.completion_log` | summary line per log | `member_id`, `logged_at` |
| `coaching.assessment_result` | assessment name + value | `member_id`, `assessment_id` |
| `coaching.wellness_checkin` | daily readiness line | `member_id`, `checkin_date` |
| `coaching.ai_draft_log` | prior narratives (optional) | `member_id`, `kind` |

**Do not embed** raw video; store video URLs in Cloudinary and embed **coach notes** from form
review once that flow exists.

---

## Proposed schema (future migration)

```sql
-- Requires: CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE coaching.embedding_chunk (
  id           BIGSERIAL PRIMARY KEY,
  facility_id  BIGINT NOT NULL REFERENCES public.facility(id),
  member_id    BIGINT REFERENCES public.member(id),  -- null = facility-global
  source_type  TEXT NOT NULL,  -- exercise, completion_log, assessment_result, ...
  source_id    BIGINT,
  content      TEXT NOT NULL,
  embedding    vector(1536),   -- text-embedding-3-small
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON coaching.embedding_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON coaching.embedding_chunk (facility_id, member_id);
```

**Retrieval pattern** (RAG):

1. User/coach asks a question in assistant UI.
2. Embed the question (`openai.embeddings` or AI SDK embedding helper).
3. `SELECT ... ORDER BY embedding <=> $query_vec LIMIT 12` with `facility_id` + optional `member_id`.
4. Pass top chunks as **context** to `generateText` in `aiService.js`.
5. Log prompt + chunks + response to `ai_draft_log`.

---

## Embedding pipeline (batch + incremental)

1. **On write** — after exercise save, completion log, assessment result: enqueue embed job
   (or sync embed if small).
2. **Nightly batch** — re-embed changed rows (`updated_at > last_embed_at`).
3. **Model** — `text-embedding-3-small` (1536 dims, low cost, good quality).

Keep embeddings **idempotent**: `UPSERT` on `(source_type, source_id)`.

---

## Vercel AI SDK usage patterns

```js
import { generateText, embed } from 'ai'
import { openai } from '@ai-sdk/openai'

// Grounded answer
const { text } = await generateText({
  model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
  system: 'You are a coach assistant. Only use facts from CONTEXT.',
  prompt: `CONTEXT:\n${chunks.join('\n---\n')}\n\nQUESTION: ${userQuestion}`,
})
```

For streaming coach UI later: `streamText` + SSE from a new `/api/coach/ai/assistant` route.

---

## Security & tenancy

- Every retrieval query must include `facility_id` from `req.platformAuth`.
- Member-scoped assistant: also filter `member_id` (or family) so athletes never see other
  athletes’ chunks.
- Never send other facilities’ data in the same embedding index without strict filters.

---

## Implementation order (Phase H)

1. ✅ LLM abstraction + progress narrative (`aiService.js`)
2. ✅ Server PDF reports (`pdfReport.js`)
3. ⬜ `pgvector` migration + `embedding_chunk` table
4. ⬜ Embed exercises + recent completion logs (batch script)
5. ⬜ `/api/coach/ai/assistant` with RAG + `ai_draft_log`
6. ⬜ Upgrade autotag / nl-needs to LLM with rule fallback (already partially rule-based)

Video form-review (Phase G remainder) feeds **text notes** into the same embedding pipeline
once coaches annotate submissions.
