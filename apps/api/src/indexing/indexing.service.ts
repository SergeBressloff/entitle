import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { Chunk } from "../chunking/chunk.entity";
import { EmbeddingApiService } from "../embeddings/embedding-api.service";
import { buildDocumentText } from "../embeddings/embedding-text";
import { EMBEDDING_MODEL } from "../embeddings/embeddings.types";
import { EmbeddingRunSummary } from "./indexing.types";

const BATCH_SIZE = 32;

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    @InjectRepository(Chunk)
    private readonly chunksRepository: Repository<Chunk>,
    private readonly embeddingApi: EmbeddingApiService,
  ) {}

  async embedPending(force = false): Promise<EmbeddingRunSummary> {
    // 1. load candidates: everything if force, otherwise only rows whose
    //    embedding is null. Order by id so runs are reproducible.
    let candidates: Chunk[];
    if (force) {
      candidates = await this.chunksRepository.find({ order: { id: "ASC" } });
    } else {
      candidates = await this.chunksRepository.find({
        where: { embedding: IsNull() },
        order: { id: "ASC" },
      });
    }

    // 2. summary object, same shape as ChunkRunSummary
    const summary: EmbeddingRunSummary = {
      candidates: candidates.length,
      embedded: 0,
      failed: 0,
      failures: [],
    };

    // 3. for each slice of BATCH_SIZE:
    for (let start = 0; start < candidates.length; start += BATCH_SIZE) {
      const slice = candidates.slice(start, start + BATCH_SIZE);

      try {
        //      a. texts = slice.map((chunk) => buildDocumentText(chunk))
        const texts = slice.map((chunk) => buildDocumentText(chunk));

        //      b. vectors = await this.embeddingApi.embed(texts)
        const vectors = await this.embeddingApi.embed(texts);

        //      c. throw if vectors.length !== slice.length — a silent
        //         mismatch would pair vectors with the wrong chunks

        if (vectors.length !== slice.length) {
          throw new Error("Mismatch between vectors and chunks");
        }

        //      d. assign embedding / embeddingModel / embeddedAt onto each entity
        slice.forEach((chunk, i) => {
          chunk.embedding = vectors[i];
          chunk.embeddingModel = EMBEDDING_MODEL;
          chunk.embeddedAt = new Date();
        });

        //      e. await this.chunksRepository.save(slice)
        await this.chunksRepository.save(slice);
        summary.embedded += slice.length;
      } catch (error) {
        summary.failed += slice.length;
        const reason = error instanceof Error ? error.message : String(error);
        summary.failures.push({
          chunkIds: slice.map((chunk) => chunk.id),
          reason,
        });
        this.logger.warn(
          `Embedding failed for chunks ${slice.map((chunk) => chunk.id).join(", ")}: ${reason}`,
        );
      }
    }

    //      f. wrap c–e in try/catch: on failure push a EmbeddingFailure
    //         with the slice's ids and carry on

    // 4. return summary
    return summary;
  }

  async countEmbedded(): Promise<{ embedded: number; total: number }> {
    // 5. two counts
    const [embedded, total] = await Promise.all([
      this.chunksRepository.count({
        where: { embedding: Not(IsNull()) },
      }),
      this.chunksRepository.count(),
    ]);

    return { embedded, total };
  }
}
