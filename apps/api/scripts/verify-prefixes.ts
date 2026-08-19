import "reflect-metadata";
import { readFileSync } from "node:fs";
import {
  buildDocumentText,
  buildQueryText,
} from "../src/embeddings/embedding-text";

const BASE_URL = "http://localhost:8081";

// From part A. The document one may need a title substituted in.
const QUERY_PREFIX = "task: search result | query: ";
const DOC_PREFIX = "title: none | text: ";

interface SampleChunk {
  id: string;
  document_title: string;
  part_title: string | null;
  heading: string | null;
  text: string;
}

// expectedId: the one chunk that should rank first for this query.
// Full uuids, not the 8-char prefixes you skimmed with.
const LABELLED: { query: string; expectedId: string }[] = [
  {
    query: "is Universal Credit ever paid twice a month?",
    expectedId: "75d5f355-e0d7-460c-8394-c1db10044054",
  },
  {
    query:
      "Can I receive Universal Credit if I receive another benefit such as Housing Benefit?",
    expectedId: "1e9dc4bd-db2a-4a9c-b517-986685a4c46e",
  },
  {
    query: "how much do I get a month if I'm single and 26?",
    expectedId: "d4fa508e-0f83-4a5f-8794-3954faed8d38",
  },
  {
    query:
      "can I get some money early while I'm waiting for my claim to come through?",
    expectedId: "9e6dd9d8-75d1-4da3-a961-bc1835335b52",
  },
  {
    query: "I'm 17 - am I too young to claim?",
    expectedId: "08db650c-82ad-41b5-bff5-c50440c42962",
  },
  {
    query: "will I have to go in and speak to someone after I apply?",
    expectedId: "c0bd6fa1-9a34-448a-98a3-4d24e8d1c57e",
  },
];

const BATCH_SIZE = 8;

async function embed(texts: string[]): Promise<number[][]> {
  const all: number[][] = [];

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const slice = texts.slice(start, start + BATCH_SIZE);

    // 1. POST to `${BASE_URL}/v1/embeddings` with body { input: texts }
    const response = await fetch(`${BASE_URL}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: slice }),
    });

    // 2. throw if !response.ok, including response.text() in the message
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status}, body: ${await response.text()}`,
      );
    }

    // 3. const json = (await response.json()) as {
    //      data: { index: number; embedding: number[] }[];
    //    };
    const json = (await response.json()) as {
      data: { index: number; embedding: number[] }[];
    };

    // 4. sort json.data by `index`, then map to `embedding`. The server is
    //    not obliged to return them in the order you sent them.
    const sortedData = json.data.sort((a, b) => a.index - b.index);
    all.push(...sortedData.map((item) => item.embedding));
  }
  return all;
}

function dot(a: number[], b: number[]): number {
  // 5. sum of a[i] * b[i]. The vectors are unit length, so this IS cosine.
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

function rankOf(
  queryVec: number[],
  chunkVecs: number[][],
  chunks: SampleChunk[],
  expectedId: string,
): number {
  // 6. score every chunk against queryVec, sort descending, and return the
  //    1-based position of expectedId. Return 0 if it isn't there at all.
  const scores = chunkVecs
    .map((chunkVec, index) => ({
      chunk: chunks[index],
      score: dot(queryVec, chunkVec),
    }))
    .sort((a, b) => b.score - a.score);

  const rank = scores.findIndex((s) => s.chunk.id === expectedId) + 1;
  return rank > 0 ? rank : 0;
}

// The JSON dump carries the database's snake_case column names; the shipped
// helpers take the entity's camelCase property names. Adapt, don't duplicate.
function toEntityShape(chunk: SampleChunk) {
  return {
    documentTitle: chunk.document_title,
    partTitle: chunk.part_title,
    heading: chunk.heading,
    text: chunk.text,
  };
}

const DIMENSION_SET = [512, 256, 128];

function truncate(vec: number[], dims: number): number[] {
  // 1. take the first `dims` elements
  // 2. compute the L2 norm of that slice — sqrt of the sum of squares
  // 3. divide every element by that norm
  const slice = vec.slice(0, dims);
  const norm = Math.hypot(...slice);
  return slice.map((x) => x / norm);
}

async function main() {
  const chunks: SampleChunk[] = JSON.parse(
    readFileSync("scripts/sample-chunks.json", "utf8"),
  );

  // Only `titled` is what we ship, so only `titled` is built by the shipped
  // code. The other three are deliberate deviations, spelled out locally.
  const conditions = [
    {
      name: "correct",
      q: (query: string) => QUERY_PREFIX + query,
      d: (c: SampleChunk) => `title: none | text: ${c.text}`,
    },
    {
      name: "none",
      q: (query: string) => query,
      d: (c: SampleChunk) => c.text,
    },
    {
      name: "swapped",
      q: (query: string) => DOC_PREFIX + query,
      d: (c: SampleChunk) => `${QUERY_PREFIX}${c.text}`,
    },
    {
      name: "titled",
      q: buildQueryText,
      d: (c: SampleChunk) => buildDocumentText(toEntityShape(c)),
    },
  ];

  for (const condition of conditions) {
    // 7.  chunkVecs = await embed(chunks.map(condition.d));
    const chunkVecs = await embed(chunks.map(condition.d));

    // 8.  queryVecs = await embed(LABELLED.map((l) => condition.q + l.query))
    const queryVecs = await embed(LABELLED.map((l) => condition.q(l.query)));

    // 9.  ranks = LABELLED.map((l, i) => rankOf(queryVecs[i], chunkVecs, chunks, l.expectedId))
    const ranks = LABELLED.map((l, i) =>
      rankOf(queryVecs[i], chunkVecs, chunks, l.expectedId),
    );

    // 10. print condition.name, the ranks array, and mean reciprocal rank:
    //     the mean of 1/rank, treating rank 0 as contributing 0
    const meanReciprocalRank =
      ranks.reduce((sum, rank) => sum + (rank > 0 ? 1 / rank : 0), 0) /
      ranks.length;
    console.log(`Condition: ${condition.name}`);
    console.log(`Ranks: ${ranks}`);
    console.log(`Mean Reciprocal Rank: ${meanReciprocalRank}`);

    // 11. for each dims in DIMENSION_SET, repeat the ranking with truncated vectors
    for (const dims of DIMENSION_SET) {
      const truncatedChunkVecs = chunkVecs.map((vec) => truncate(vec, dims));
      const truncatedQueryVecs = queryVecs.map((vec) => truncate(vec, dims));
      const truncatedRanks = LABELLED.map((l, i) =>
        rankOf(truncatedQueryVecs[i], truncatedChunkVecs, chunks, l.expectedId),
      );
      const truncatedMeanReciprocalRank =
        truncatedRanks.reduce(
          (sum, rank) => sum + (rank > 0 ? 1 / rank : 0),
          0,
        ) / truncatedRanks.length;
      console.log(`Truncated to ${dims} dimensions:`);
      console.log(`Ranks: ${truncatedRanks}`);
      console.log(`Mean Reciprocal Rank: ${truncatedMeanReciprocalRank}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
