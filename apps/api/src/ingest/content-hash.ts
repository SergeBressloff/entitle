import { createHash } from "node:crypto";

/**
 * The fields that constitute "the guidance".
 *
 * Deliberately narrow. The full payload also carries `updated_at`,
 * `publishing_request_id` and friends, which change on every platform-wide
 * republish without anyone editing a word — three unrelated documents were
 * last "updated" within seven minutes of each other. Hashing those would
 * write a new version row on every crawl and tell us nothing.
 *
 * `links` is excluded for the same reason: that graph shifts when *other*
 * documents are edited.
 */
const HASHED_FIELDS = [
  "title",
  "description",
  "details",
  "withdrawn_notice",
] as const;

/**
 * Serialise deterministically: object keys sorted, array order preserved.
 *
 * JSON.stringify follows insertion order, which is stable in practice but not
 * guaranteed — if gov.uk ever reorders its response the hash would change for
 * unchanged content. Array order is left alone because it is meaningful:
 * details.parts[0] is the first chapter of a guide, not an unordered member.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    // JSON.stringify(undefined) returns undefined rather than a string.
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    // Compare code units rather than using localeCompare, which is
    // locale-dependent and so not reproducible across machines.
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

/**
 * A SHA-256 over the guidance-bearing fields of a Content API payload.
 *
 * Used to decide whether a re-fetched document has actually changed, and so
 * whether it needs a new version row and re-embedding.
 */
export function contentHash(raw: Record<string, unknown>): string {
  const subset: Record<string, unknown> = {};

  for (const field of HASHED_FIELDS) {
    // Normalise absent to null so a missing key and an explicit null hash
    // identically — gov.uk switching between the two is not a content change.
    subset[field] = raw[field] ?? null;
  }

  return createHash("sha256").update(stableStringify(subset)).digest("hex");
}
