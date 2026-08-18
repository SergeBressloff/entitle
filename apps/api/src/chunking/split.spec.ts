import { splitByHeadings, splitMarkdown } from "./split";

/**
 * Mirrors the constants in split.ts. Kept local so these tests assert the
 * contract rather than reaching into the module's private configuration.
 */
const TARGET_CHARS = 1200;
const MAX_CHARS = 2000;

function paragraphOf(chars: number): string {
  return "x".repeat(chars);
}

/** A pipe table with `rows` data rows, comfortably over MAX_CHARS. */
function tableOf(rows: number): string {
  const header = "| Benefit | Weekly rate |";
  const separator = "| --- | --- |";
  const body = Array.from(
    { length: rows },
    (_, i) => `| Benefit number ${i} for eligible claimants | £${100 + i}.50 |`,
  );

  return [header, separator, ...body].join("\n");
}

describe("splitByHeadings", () => {
  it("returns nothing for empty input", () => {
    expect(splitByHeadings("")).toEqual([]);
    expect(splitByHeadings("   \n  ")).toEqual([]);
  });

  it("gives text before the first heading a null heading", () => {
    const sections = splitByHeadings("Intro text.\n\n## Eligibility\n\nBody.");

    expect(sections[0]).toEqual({ heading: null, text: "Intro text." });
  });

  it("strips the hashes from a heading", () => {
    const sections = splitByHeadings("## Eligibility\n\nYou must be 18.");

    expect(sections).toEqual([
      { heading: "Eligibility", text: "You must be 18." },
    ]);
  });

  it("handles every heading level", () => {
    const markdown = "# One\n\nA.\n\n### Three\n\nB.\n\n###### Six\n\nC.";

    expect(splitByHeadings(markdown).map((s) => s.heading)).toEqual([
      "One",
      "Three",
      "Six",
    ]);
  });

  it("drops a heading with no body", () => {
    const sections = splitByHeadings("## Empty\n\n## Has body\n\nSome text.");

    expect(sections).toEqual([{ heading: "Has body", text: "Some text." }]);
  });
});

describe("splitMarkdown", () => {
  it("keeps paragraphs together while they fit the target", () => {
    const markdown = `## Rates\n\n${paragraphOf(500)}\n\n${paragraphOf(500)}`;
    const chunks = splitMarkdown(markdown);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe("Rates");
    expect(chunks[0].text.length).toBe(1002);
  });

  it("starts a new chunk when the target would be exceeded", () => {
    const markdown = `## Rates\n\n${paragraphOf(700)}\n\n${paragraphOf(700)}`;
    const chunks = splitMarkdown(markdown);

    expect(chunks).toHaveLength(2);
    expect(chunks.every((c) => c.heading === "Rates")).toBe(true);
    expect(chunks.every((c) => c.text.length <= TARGET_CHARS)).toBe(true);
  });

  it("carries the heading onto every piece of a split section", () => {
    const markdown = `### How much you can get\n\n${paragraphOf(900)}\n\n${paragraphOf(900)}\n\n${paragraphOf(900)}`;

    expect(splitMarkdown(markdown).map((c) => c.heading)).toEqual([
      "How much you can get",
      "How much you can get",
      "How much you can get",
    ]);
  });

  it("splits an oversized table on row boundaries, repeating the header", () => {
    const table = tableOf(50);
    expect(table.length).toBeGreaterThan(MAX_CHARS);

    const chunks = splitMarkdown(`## Rates\n\n${table}`);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      const lines = chunk.text.split("\n");
      expect(lines[0]).toBe("| Benefit | Weekly rate |");
      expect(lines[1]).toBe("| --- | --- |");
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHARS);
    }
  });

  it("loses no table rows when it splits one", () => {
    const chunks = splitMarkdown(`## Rates\n\n${tableOf(50)}`);

    const dataRows = chunks.flatMap((chunk) =>
      chunk.text.split("\n").filter((line) => line.startsWith("| Benefit num")),
    );

    expect(dataRows).toHaveLength(50);
    expect(new Set(dataRows).size).toBe(50);
  });

  it("splits oversized prose on sentence boundaries", () => {
    const sentence = "Universal Credit is paid monthly to the claimant. ";
    const prose = sentence.repeat(80).trim();
    expect(prose.length).toBeGreaterThan(MAX_CHARS);

    const chunks = splitMarkdown(`## Payments\n\n${prose}`);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHARS);
      expect(chunk.text.trim().endsWith(".")).toBe(true);
    }
  });

  it("hard-slices text with no usable boundary", () => {
    const blob = paragraphOf(5000);
    const chunks = splitMarkdown(`## Blob\n\n${blob}`);

    expect(chunks.every((c) => c.text.length <= MAX_CHARS)).toBe(true);
    expect(chunks.map((c) => c.text).join("")).toBe(blob);
  });

  it("never emits a chunk over MAX_CHARS", () => {
    const markdown = [
      "## One",
      paragraphOf(5000),
      "## Two",
      tableOf(60),
      "## Three",
      "A short sentence. ".repeat(200).trim(),
    ].join("\n\n");

    const chunks = splitMarkdown(markdown);

    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.filter((c) => c.text.length > MAX_CHARS)).toEqual([]);
  });
});
