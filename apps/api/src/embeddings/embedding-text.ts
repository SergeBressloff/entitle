import { Chunk } from "../chunking/chunk.entity";

export const QUERY_PREFIX = "task: search result | query: ";

type ChunkHeadings = Pick<Chunk, "documentTitle" | "partTitle" | "heading">;

export function headingPath(chunk: ChunkHeadings): string {
  // 1. put the three fields in an array, drop the nulls, join with " › "
  const headings = [chunk.documentTitle, chunk.partTitle, chunk.heading]
    .filter((s) => s !== null)
    .join(" › ");

  // 2. if nothing survives, return "none" — the model's own convention
  //    for "this document has no title"
  // This is unreachable in practice, since the documentTitle is not nullable.
  // But we keep it for completeness.
  if (!headings) {
    return "none";
  }

  return headings;
}

export function buildDocumentText(
  chunk: ChunkHeadings & Pick<Chunk, "text">,
): string {
  // 3. `title: ${headingPath(chunk)} | text: ${chunk.text}`
  return `title: ${headingPath(chunk)} | text: ${chunk.text}`;
}

export function buildQueryText(query: string): string {
  // 4. QUERY_PREFIX + query
  return QUERY_PREFIX + query;
}
