export interface MarkdownSection {
  heading: string | null;
  text: string;
}

const TARGET_CHARS = 1200;
const MAX_CHARS = 2000;

const HEADING_LINE = /^#{1,6}\s+(.+)$/;

export function splitByHeadings(markdown: string): MarkdownSection[] {
  // exported separately so it can be tested on its own
  if (markdown.trim().length === 0) {
    return [];
  }

  return markdown
    .split(/\n(?=#{1,6}\s)/)
    .map((section) => {
      const lines = section.split("\n");
      const match = lines[0].match(HEADING_LINE);

      if (match) {
        return {
          heading: match[1].trim(),
          text: lines.slice(1).join("\n").trim(),
        };
      }

      return { heading: null, text: section.trim() };
    })
    .filter((section) => section.text.length > 0);
}

function isTable(text: string): boolean {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  return lines.length > 2 && lines.every((line) => line.trim().startsWith("|"));
}

function splitTable(text: string): string[] {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const header = lines.slice(0, 2);
  const headerLength = header.join("\n").length;

  const pieces: string[] = [];
  let buffer: string[] = [];

  for (const row of lines.slice(2)) {
    const projected = headerLength + buffer.join("\n").length + row.length + 2;

    if (buffer.length > 0 && projected > TARGET_CHARS) {
      pieces.push([...header, ...buffer].join("\n"));
      buffer = [];
    }

    buffer.push(row);
  }

  if (buffer.length > 0) {
    pieces.push([...header, ...buffer].join("\n"));
  }

  return pieces;
}

function splitSentences(text: string): string[] {
  const pieces: string[] = [];
  let buffer = "";

  for (const sentence of text.split(/(?<=\.)\s+(?=[A-Z£0-9])/)) {
    if (buffer.length === 0) {
      buffer = sentence;
    } else if (buffer.length + 1 + sentence.length <= TARGET_CHARS) {
      buffer = `${buffer} ${sentence}`;
    } else {
      pieces.push(buffer);
      buffer = sentence;
    }
  }

  if (buffer.length > 0) {
    pieces.push(buffer);
  }

  return pieces;
}

function hardSlice(text: string): string[] {
  const pieces: string[] = [];

  for (let start = 0; start < text.length; start += MAX_CHARS) {
    pieces.push(text.slice(start, start + MAX_CHARS));
  }

  return pieces;
}

function splitOversized(text: string): string[] {
  const pieces = isTable(text) ? splitTable(text) : splitSentences(text);

  return pieces.flatMap((piece) =>
    piece.length > MAX_CHARS ? hardSlice(piece) : [piece],
  );
}

export function splitMarkdown(markdown: string): MarkdownSection[] {
  // splitByHeadings, then pack each section's paragraphs to TARGET_CHARS
  const results: MarkdownSection[] = [];

  for (const section of splitByHeadings(markdown)) {
    let buffer: string[] = [];

    const flush = () => {
      if (buffer.length > 0) {
        results.push({ heading: section.heading, text: buffer.join("\n\n") });
        buffer = [];
      }
    };

    const paragraphs = section.text
      .split(/\n{2,}/)
      .filter((paragraph) => paragraph.trim().length > 0);

    for (const paragraph of paragraphs) {
      if (paragraph.length > MAX_CHARS) {
        flush();

        for (const piece of splitOversized(paragraph)) {
          results.push({ heading: section.heading, text: piece });
        }

        continue;
      }

      if (buffer.length === 0) {
        buffer.push(paragraph);
      } else if (
        buffer.join("\n\n").length + 2 + paragraph.length <=
        TARGET_CHARS
      ) {
        buffer.push(paragraph);
      } else {
        flush();
        buffer.push(paragraph);
      }
    }

    flush();
  }

  return results;
}
