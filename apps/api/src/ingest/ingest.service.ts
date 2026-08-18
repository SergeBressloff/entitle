import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { GovukApiService } from "../govuk-api/govuk-api.service";
import { GovukContent, GuideDetailsSchema } from "../govuk-api/govuk-api.types";
import { contentHash } from "./content-hash";
import { GovukDocument } from "./document.entity";
import { DocumentVersion } from "./document-version.entity";

export type IngestOutcome = "created" | "unchanged" | "updated";

export interface IngestResult {
  outcome: IngestOutcome;
  contentId: string;
  title: string;
}

export interface IngestFailure {
  basePath: string;
  reason: string;
}

export interface IngestRunSummary {
  query: string;
  found: number;
  created: number;
  unchanged: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: IngestFailure[];
}

// Document types that carry no body worth retrieving.
const SKIPPED_DOCUMENT_TYPES = new Set([
  "transaction",
  "smart_answer",
  "local_transaction",
]);

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    // We use the repository directly (by injecting) to count documents,
    // since this only touches the documents table and is not part of a transaction.
    // The ingestDocument method uses a transaction and gets repositories from the manager.
    @InjectRepository(GovukDocument)
    private readonly documentsRepository: Repository<GovukDocument>,
    private readonly govukApiService: GovukApiService,
    private readonly dataSource: DataSource,
  ) {}

  async countDocuments(): Promise<number> {
    return await this.documentsRepository.count();
  }

  private async findByContentId(
    repository: Repository<GovukDocument>,
    contentId: string,
  ): Promise<GovukDocument | null> {
    return await repository.findOneBy({ contentId });
  }

  private toDocumentFields(
    document: GovukContent,
    raw: Record<string, unknown>,
    hash: string,
    now: Date,
  ): Omit<GovukDocument, "id" | "firstFetchedAt"> {
    return {
      contentId: document.content_id,
      basePath: document.base_path,
      title: document.title,
      description: document.description ?? null,
      schemaName: document.schema_name,
      documentType: document.document_type,
      locale: document.locale,
      phase: document.phase ?? null,
      withdrawn: Object.keys(document.withdrawn_notice ?? {}).length > 0,
      firstPublishedAt: document.first_published_at ?? null,
      publicUpdatedAt: document.public_updated_at ?? null,
      sourceUpdatedAt: document.updated_at ?? null,
      contentHash: hash,
      raw,
      lastFetchedAt: now,
    };
  }

  private toVersionFields(
    documentId: string,
    document: GovukContent,
    raw: Record<string, unknown>,
    hash: string,
  ): Omit<DocumentVersion, "id" | "fetchedAt" | "document"> {
    return {
      documentId: documentId,
      contentHash: hash,
      publicUpdatedAt: document.public_updated_at ?? null,
      raw: raw,
    };
  }

  async ingestDocument(basePath: string): Promise<IngestResult> {
    const { document, raw } = await this.govukApiService.fetchContent(basePath);
    const hash = contentHash(raw);

    return await this.dataSource.transaction(async (manager) => {
      const documents = manager.getRepository(GovukDocument);
      const versions = manager.getRepository(DocumentVersion);

      const existing = await this.findByContentId(
        documents,
        document.content_id,
      );
      const now = new Date();

      // Branch 1 — never seen: save the document, then version 1.
      if (existing === null) {
        // save the document (you need the returned object for its id)
        // save a version row: documentId, contentHash, publicUpdatedAt, raw
        // return outcome "created"
        const savedDocument = await documents.save(
          this.toDocumentFields(document, raw, hash, now),
        );
        await versions.save(
          this.toVersionFields(savedDocument.id, document, raw, hash),
        );
        return {
          outcome: "created",
          contentId: savedDocument.contentId,
          title: savedDocument.title,
        };
      }

      // Branch 2 — seen before, guidance unchanged: record only that we looked.
      if (existing.contentHash === hash) {
        // update the row's lastFetchedAt to `now` — nothing else, no version row
        // return outcome "unchanged"
        await documents.update(existing.id, { lastFetchedAt: now });
        return {
          outcome: "unchanged",
          contentId: existing.contentId,
          title: existing.title,
        };
      }

      // Branch 3 — guidance changed: update the row and append a version.
      // update the document row with the full mapped fields
      // save a version row, same shape as branch 1
      // return outcome "updated"
      await documents.save({
        id: existing.id,
        ...this.toDocumentFields(document, raw, hash, now),
      });
      await versions.save(
        this.toVersionFields(existing.id, document, raw, hash),
      );
      return {
        outcome: "updated",
        contentId: existing.contentId,
        title: existing.title,
      };
    });
  }

  /**
   * Fetch one document and report what came back. Nothing is persisted.
   */
  async previewDocument(basePath: string) {
    const { document, raw } = await this.govukApiService.fetchContent(basePath);
    const existing = await this.findByContentId(
      this.documentsRepository,
      document.content_id,
    );

    // Only guides carry parts. Other shapes are parsed at chunking time.
    let partsCount: number | null = null;
    if (document.schema_name === "guide") {
      partsCount = GuideDetailsSchema.parse(document.details).parts.length;
    }

    return {
      contentId: document.content_id,
      basePath: document.base_path,
      title: document.title,
      schemaName: document.schema_name,
      documentType: document.document_type,
      locale: document.locale,
      publicUpdatedAt: document.public_updated_at,
      sourceUpdatedAt: document.updated_at,
      // {} is truthy, so emptiness is the test — not the object itself.
      withdrawn: Object.keys(document.withdrawn_notice ?? {}).length > 0,
      partsCount,
      contentHash: contentHash(raw),
      alreadyStored: existing !== null,
    };
  }

  async searchPaths(query: string, count: number) {
    return await this.govukApiService.search(query, count);
  }

  async ingestSearch(query: string, count: number): Promise<IngestRunSummary> {
    const results = await this.govukApiService.search(query, count);

    const summary: IngestRunSummary = {
      query,
      found: results.length,
      created: 0,
      unchanged: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      failures: [],
    };

    for (const searchResult of results) {
      if (
        SKIPPED_DOCUMENT_TYPES.has(
          searchResult.content_store_document_type ?? "",
        )
      ) {
        summary.skipped += 1;
        continue;
      }

      try {
        const { outcome } = await this.ingestDocument(searchResult.link);
        summary[outcome] += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);

        summary.failed += 1;
        summary.failures.push({ basePath: searchResult.link, reason });
        this.logger.warn(`Ingest failed for ${searchResult.link}: ${reason}`);
      }
    }

    return summary;
  }
}
