import { z } from "zod";

/**
 * The fields we promote out of a gov.uk Content API response into columns.
 *
 * `details` is deliberately left unparsed: its shape depends on `schema_name`
 * (`parts[]` for a guide, `body` for an answer, neither for a transaction), so
 * it is validated per-type at chunking time instead.
 */
export const GovukContentSchema = z.object({
  content_id: z.uuid(),
  base_path: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  schema_name: z.string(),
  document_type: z.string(),
  locale: z.string(),
  phase: z.string().nullish(),
  // gov.uk timestamps carry an offset ("+01:00"), which z.iso.datetime()
  // rejects by default. z.coerce.date() accepts them and yields a real Date.
  first_published_at: z.coerce.date().nullish(),
  public_updated_at: z.coerce.date().nullish(),
  updated_at: z.coerce.date().nullish(),
  withdrawn_notice: z.record(z.string(), z.unknown()).nullish(),
  details: z.unknown().optional(),
});

export type GovukContent = z.infer<typeof GovukContentSchema>;

export const GuidePartSchema = z.object({
  slug: z.string(),
  title: z.string(),
  body: z.string(),
});

export const GuideDetailsSchema = z.object({
  parts: z.array(GuidePartSchema),
});

export type GuidePart = z.infer<typeof GuidePartSchema>;

/**
 * Both halves of a fetch: the validated fields, and the untouched payload.
 *
 * z.object() strips unknown keys, so the parse output has already lost
 * `details` and every guide part. The `raw` column needs the original.
 */
export interface GovukContentResult {
  document: GovukContent;
  raw: Record<string, unknown>;
}

export const GovukSearchResultSchema = z.object({
  link: z.string(),
  title: z.string(),
  content_store_document_type: z.string().nullish(),
});

export const GovukSearchResponseSchema = z.object({
  results: z.array(GovukSearchResultSchema),
  total: z.number(),
  start: z.number(),
});

export type GovukSearchResult = z.infer<typeof GovukSearchResultSchema>;
