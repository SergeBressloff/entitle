import { readFileSync } from "node:fs";

const BASE_URL = "http://localhost:8081";
const DOC_PREFIX = "title: none | text: ";

interface SampleChunk {
  id: string;
  text: string;
}

async function countTokens(text: string): Promise<number> {
  // 1. POST to `${BASE_URL}/tokenize` with body { content: text }
  const response = await fetch(`${BASE_URL}/tokenize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text }),
  });

  // 2. ok-check as before
  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status}, body: ${await response.text()}`,
    );
  }

  // 3. json is { tokens: number[] } — return tokens.length
  const json = (await response.json()) as { tokens: number[] };
  return json.tokens.length;
}

function percentile(sorted: number[], p: number): number {
  // 4. sorted is ascending. Return the value at Math.floor(p * sorted.length),
  //    clamped so p = 1 doesn't index off the end.
  const index = Math.floor(p * sorted.length);
  return sorted[Math.min(index, sorted.length - 1)];
}

async function main() {
  const chunks: SampleChunk[] = JSON.parse(
    readFileSync("scripts/sample-chunks.json", "utf8"),
  );

  // 5. count tokens for each chunk, WITH the document prefix on the front —
  //    that is what actually gets embedded, so that is what to measure.
  //    A plain `for` loop is fine; 343 sequential calls take seconds.
  const counts: number[] = [];
  for (const chunk of chunks) {
    const text = `${DOC_PREFIX}${chunk.text}`;
    const count = await countTokens(text);
    counts.push(count);
  }

  // 6. sort a COPY of the counts ascending: [...counts].sort((a, b) => a - b)
  //    Remember sort mutates, and you want the original order intact for step 7.
  const sortedCounts = [...counts].sort((a, b) => a - b);

  // 7. print min, p50, p95, max, how many exceed 2048, and the mean
  //    characters-per-token across the corpus.
  const min = percentile(sortedCounts, 0);
  const p50 = percentile(sortedCounts, 0.5);
  const p95 = percentile(sortedCounts, 0.95);
  const max = percentile(sortedCounts, 1);
  const exceed2048 = counts.filter((c) => c > 2048).length;
  const meanCharsPerToken =
    chunks.reduce((sum, c) => sum + c.text.length, 0) /
    counts.reduce((sum, c) => sum + c, 0);

  console.log(`Min: ${min}`);
  console.log(`P50: ${p50}`);
  console.log(`P95: ${p95}`);
  console.log(`Max: ${max}`);
  console.log(`Exceeding 2048: ${exceed2048}`);
  console.log(`Mean Characters Per Token: ${meanCharsPerToken}`);

  // Does putting a real title there beat the word "none"?
  // 8.  const prefixTokens = await countTokens(DOC_PREFIX);
  const prefixTokens = await countTokens(DOC_PREFIX);

  // 9.  total body characters: sum of chunk.text.length across chunks
  const totalBodyChars = chunks.reduce((sum, c) => sum + c.text.length, 0);

  // 10. total body tokens: sum of counts, minus prefixTokens × counts.length
  //     (every count includes the prefix, so subtract it back out)
  const totalBodyTokens =
    counts.reduce((sum, c) => sum + c, 0) - prefixTokens * counts.length;

  // 11. charsPerToken = totalBodyChars / totalBodyTokens
  const charsPerTokenBody = totalBodyChars / totalBodyTokens;

  // 12. print prefixTokens, charsPerToken, and 1200 / charsPerToken —
  //     that last number is what TARGET_CHARS actually is, in tokens
  console.log(`Prefix Tokens: ${prefixTokens}`);
  console.log(`Characters Per Token in Body: ${charsPerTokenBody}`);
  console.log(`Target Chars (in tokens): ${1200 / charsPerTokenBody}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
