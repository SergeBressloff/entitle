export interface EmbeddingFailure {
  chunkIds: string[];
  reason: string;
}

export interface EmbeddingRunSummary {
  candidates: number;
  embedded: number;
  failed: number;
  failures: EmbeddingFailure[];
}
