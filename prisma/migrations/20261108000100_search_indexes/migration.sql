-- Full-text search index over RAG chunks (expression must match src/lib/ai/retrieval.ts).
CREATE INDEX IF NOT EXISTS "Embedding_fts_idx"
  ON "Embedding" USING GIN (to_tsvector('english', title || ' ' || content));

-- Approximate nearest-neighbour index for cosine similarity (pgvector >= 0.5).
CREATE INDEX IF NOT EXISTS "Embedding_vector_idx"
  ON "Embedding" USING hnsw (embedding vector_cosine_ops);

-- Trigram-free prefix search helpers for instant search.
CREATE INDEX IF NOT EXISTS "Driver_familyName_idx" ON "Driver" (lower("familyName"));
CREATE INDEX IF NOT EXISTS "Race_winnerDriverId_idx" ON "Race" ("winnerDriverId");
CREATE INDEX IF NOT EXISTS "Race_year_idx" ON "Race" ("year");
CREATE INDEX IF NOT EXISTS "Result_raceId_idx" ON "Result" ("raceId");
