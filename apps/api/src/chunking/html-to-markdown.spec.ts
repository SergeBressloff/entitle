import { htmlToMarkdown } from "./html-to-markdown";

describe("htmlToMarkdown", () => {
  it("h2 headings start with ##", () => {
    const html = "<h2>Heading</h2>";
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBe("## Heading");
  });

  it("a link loses its url and keeps its text", () => {
    const html = '<a href="https://www.gov.uk">Gov.uk</a>';
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBe("Gov.uk");
  });

  it("a table keep its column binding", () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Column 1</th>
            <th>Column 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Row 1, Cell 1</td>
            <td>Row 1, Cell 2</td>
          </tr>
        </tbody>
      </table>
    `;
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBe(
      "| Column 1 | Column 2 |\n| --- | --- |\n| Row 1, Cell 1 | Row 1, Cell 2 |",
    );
  });

  it("a <ul> list is converted to a markdown list", () => {
    const html = `
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    `;
    const markdown = htmlToMarkdown(html);
    const lines = markdown.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^-\s+Item 1$/);
    expect(lines[1]).toMatch(/^-\s+Item 2$/);
  });

  it("empty html returns an empty string", () => {
    const html = "";
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBe("");
  });

  it("No ]( appears anywhere in the output of something containing several links", () => {
    const html = `
      <p>Some text with a <a href="https://www.gov.uk">link</a> and another <a href="https://www.example.com">link</a>.</p>
    `;
    const markdown = htmlToMarkdown(html);

    expect(markdown).not.toContain("](");
  });
});
