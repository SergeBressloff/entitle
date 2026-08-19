import { z } from "zod";

export const EMBEDDING_DIMENSIONS = 768;

export const EmbeddingResponseSchema = z.object({
  data: z
    .array(
      z.object({
        index: z.number(),
        embedding: z.array(z.number()).length(EMBEDDING_DIMENSIONS),
      }),
    )
    .min(1),
});

export const EMBEDDING_MODEL = "embeddinggemma-300m-q8:768:titled";
