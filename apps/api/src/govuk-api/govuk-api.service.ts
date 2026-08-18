import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GovukContentResult,
  GovukContentSchema,
  GovukSearchResponseSchema,
  GovukSearchResult,
} from "./govuk-api.types";

const USER_AGENT = "entitle/0.0.1 (+https://github.com/SergeBressloff/entitle)";
const REQUEST_TIMEOUT_MS = 10_000;

// gov.uk's documented limit is 10/s. Half of it is plenty and leaves headroom.
const MAX_REQUESTS_PER_SECOND = 5;
const MIN_REQUEST_INTERVAL_MS = 1000 / MAX_REQUESTS_PER_SECOND;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class GovukApiService {
  private readonly logger = new Logger(GovukApiService.name);
  private readonly govukBaseUrl: string;
  private nextRequestSlot = 0;

  constructor(configService: ConfigService) {
    const govukBaseUrl = configService.get<string>("GOVUK_BASE_URL");

    // Fail at startup, not on the first request.
    if (!govukBaseUrl) {
      throw new Error("GOVUK_BASE_URL is not set. Add it to apps/api/.env");
    }

    this.govukBaseUrl = govukBaseUrl.replace(/\/$/, "");
  }

  private async waitForSlot(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextRequestSlot);

    // Reserve before sleeping — see below.
    this.nextRequestSlot = slot + MIN_REQUEST_INTERVAL_MS;

    const wait = slot - now;
    if (wait > 0) {
      await sleep(wait);
    }
  }

  private async fetchJson(url: string): Promise<unknown> {
    await this.waitForSlot();
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      // Without this a hung connection wedges the whole ingest loop.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    // fetch only rejects on network failure. A 404 is a fulfilled promise.
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `gov.uk returned ${response.status} for ${url}: ${body.slice(0, 300)}`,
      );
    }

    return response.json();
  }

  /**
   * Fetch one document from the Content API.
   *
   * Returns the validated fields and the original payload separately — see
   * GovukContentResult for why both are needed.
   */
  async fetchContent(basePath: string): Promise<GovukContentResult> {
    // basePath arrives from search results or a request parameter and is
    // concatenated into an outbound URL. Keep it to a plain absolute path.
    if (
      !basePath.startsWith("/") ||
      basePath.includes("//") ||
      basePath.includes("..")
    ) {
      throw new Error(`Not a valid gov.uk base path: ${basePath}`);
    }

    const url = `${this.govukBaseUrl}/api/content${basePath}`;

    // `unknown`, not `any` — nothing may touch it until it has been validated.
    const raw: unknown = await this.fetchJson(url);

    const document = GovukContentSchema.parse(raw);

    this.logger.log(`Fetched ${basePath} (${document.schema_name})`);

    // parse() succeeding proves raw is an object carrying these keys.
    return { document, raw: raw as Record<string, unknown> };
  }

  async search(query: string, count: number): Promise<GovukSearchResult[]> {
    // 1. build params: q, count, and fields
    const params = new URLSearchParams({
      q: query, // q is the documented parameter name, not query.
      count: String(count),
      fields: "link,title,content_store_document_type",
    });

    // 2. call fetchJson with `${this.govukBaseUrl}/api/search.json?${params}`
    const raw: unknown = await this.fetchJson(
      `${this.govukBaseUrl}/api/search.json?${params}`,
    );

    // 3. parse with GovukSearchResponseSchema
    const searchResponse = GovukSearchResponseSchema.parse(raw);

    // 4. return only results whose link starts with "/"
    return searchResponse.results.filter((result) =>
      result.link.startsWith("/"),
    );
  }
}
