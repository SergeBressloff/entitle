import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { GovukDocument } from "../ingest/document.entity";
import { Chunk } from "./chunk.entity";
import { extractParts } from "./extract-parts";
import { htmlToMarkdown } from "./html-to-markdown";
import { splitMarkdown } from "./split";

export interface ChunkFailure {
  basePath: string;
  reason: string;
}

export interface ChunkRunSummary {
  documents: number;
  documentsChunked: number;
  skipped: number;
  chunksCreated: number;
  failed: number;
  failures: ChunkFailure[];
}

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);
  private readonly govukBaseUrl: string;

  constructor(
    @InjectRepository(GovukDocument)
    private readonly documentsRepository: Repository<GovukDocument>,
    @InjectRepository(Chunk)
    private readonly chunksRepository: Repository<Chunk>,
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    const govukBaseUrl = configService.get<string>("GOVUK_BASE_URL");

    if (!govukBaseUrl) {
      throw new Error("GOVUK_BASE_URL is not set. Add it to apps/api/.env");
    }

    this.govukBaseUrl = govukBaseUrl.replace(/\/$/, "");
  }

  private buildChunks(
    document: GovukDocument,
  ): Omit<Chunk, "id" | "createdAt" | "document">[] {
    // 1. pull details out of document.raw and call extractParts
    const parts = extractParts(document.schemaName, document.raw.details);

    const rows: Omit<Chunk, "id" | "createdAt" | "document">[] = [];
    let chunkIndex = 0;

    // 2. for each part: htmlToMarkdown(part.html), then splitMarkdown
    for (const part of parts) {
      const sections = splitMarkdown(htmlToMarkdown(part.html));

      // 3. map each section to a chunk row, with chunkIndex counting across
      //    the whole document — not restarting per part
      for (const section of sections) {
        rows.push({
          documentId: document.id,
          chunkIndex,
          sourceUrl: this.buildSourceUrl(document.basePath, part.slug),
          documentTitle: document.title,
          partSlug: part.slug,
          partTitle: part.title,
          heading: section.heading,
          text: section.text,
          charCount: section.text.length,
          publicUpdatedAt: document.publicUpdatedAt,
          documentContentHash: document.contentHash,
        });

        chunkIndex += 1;
      }
    }

    return rows;
  }

  private buildSourceUrl(basePath: string, slug: string | null): string {
    return slug
      ? `${this.govukBaseUrl}${basePath}/${slug}`
      : `${this.govukBaseUrl}${basePath}`;
  }

  async chunkDocument(document: GovukDocument): Promise<number> {
    const rows = this.buildChunks(document);

    await this.dataSource.transaction(async (manager) => {
      const chunks = manager.getRepository(Chunk);
      // delete every chunk for this document, then insert the new rows
      await chunks.delete({ documentId: document.id });
      //guard against an empty array: insert([]) errors.
      if (rows.length > 0) {
        await chunks.insert(rows);
      }
    });

    return rows.length;
  }

  async chunkAll(force = false): Promise<ChunkRunSummary> {
    // load all documents, chunk each, skip ones already chunked at this
    // document's contentHash unless force is true
    const documents = await this.documentsRepository.find();

    const summary: ChunkRunSummary = {
      documents: documents.length,
      documentsChunked: 0,
      skipped: 0,
      chunksCreated: 0,
      failed: 0,
      failures: [],
    };

    for (const document of documents) {
      try {
        // count chunks where documentId matches and documentContentHash equals
        // the document's current contentHash. Non-zero means they're current
        if (!force) {
          const existingChunks = await this.chunksRepository.count({
            where: {
              documentId: document.id,
              documentContentHash: document.contentHash,
            },
          });

          if (existingChunks > 0) {
            summary.skipped += 1;
            continue;
          }
        }

        const chunkCount = await this.chunkDocument(document);
        summary.documentsChunked += 1;
        summary.chunksCreated += chunkCount;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        summary.failed += 1;
        summary.failures.push({ basePath: document.basePath, reason });
        this.logger.warn(`Chunking failed for ${document.basePath}: ${reason}`);
      }
    }

    return summary;
  }

  async countChunks(): Promise<number> {
    return await this.chunksRepository.count();
  }
}
