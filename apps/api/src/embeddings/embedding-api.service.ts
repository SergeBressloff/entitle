import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmbeddingResponseSchema } from "./embeddings.types";

const BATCH_SIZE = 8;
const TIMEOUT_MS = 30_000;

@Injectable()
export class EmbeddingApiService {
  private readonly logger = new Logger(EmbeddingApiService.name);
  private readonly baseUrl: string;

  constructor(configService: ConfigService) {
    // 5. same shape as LlmService: read EMBEDDING_BASE_URL, throw at startup
    //    if missing, strip a trailing slash
    const baseUrl = configService.get<string>("EMBEDDING_BASE_URL");

    if (!baseUrl) {
      throw new Error("EMBEDDING_BASE_URL is not set. Add it to apps/api/.env");
    }

    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async embed(texts: string[]): Promise<number[][]> {
    const all: number[][] = [];

    // 6. loop in slices of BATCH_SIZE, same as your script
    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const slice = texts.slice(start, start + BATCH_SIZE);

      // 7. per slice: fetch POST `${this.baseUrl}/v1/embeddings`,
      //    body { input: slice }, signal: AbortSignal.timeout(TIMEOUT_MS)
      const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: slice }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      // 8. throw on !response.ok, including response.text() in the message
      if (!response.ok) {
        const body = await response.text();

        this.logger.warn(
          `Embedding batch at offset ${start} (${slice.length} texts) failed: ` +
            `${response.status} ${body.slice(0, 200)}`,
        );

        throw new Error(
          `llama-server returned ${response.status}: ${body.slice(0, 500)}`,
        );
      }

      // 9. const raw: unknown = await response.json();
      //    const parsed = EmbeddingResponseSchema.parse(raw);
      const raw: unknown = await response.json();
      const parsed = EmbeddingResponseSchema.parse(raw);

      // 10. sort parsed.data by index, map to embedding, append with push(...)
      const sortedData = parsed.data.sort((a, b) => a.index - b.index);
      all.push(...sortedData.map((item) => item.embedding));
    }
    // 11. return the accumulated array
    return all;
  }
}
