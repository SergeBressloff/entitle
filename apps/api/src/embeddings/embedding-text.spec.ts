import { buildDocumentText, headingPath } from "./embedding-text";

describe("headingPath", () => {
  it("returns a path with all three fields present", () => {
    const chunk = {
      documentTitle: "Document Title",
      partTitle: "Part Title",
      heading: "Heading",
    };

    expect(headingPath(chunk)).toContain("Heading");
    expect(headingPath(chunk)).toContain("Document Title");
    expect(headingPath(chunk)).toContain("Part Title");
  });

  it("returns a path with partTitle null", () => {
    const chunk = {
      documentTitle: "Document Title",
      partTitle: null,
      heading: "Heading",
    };

    expect(headingPath(chunk)).toContain("Heading");
    expect(headingPath(chunk)).toContain("Document Title");
    expect(headingPath(chunk)).not.toContain("null");
    expect(headingPath(chunk)).not.toContain(" ›  › ");
  });

  it("returns a path with both partTitle and heading null", () => {
    const chunk = {
      documentTitle: "Document Title",
      partTitle: null,
      heading: null,
    };

    expect(headingPath(chunk)).toContain("Document Title");
    expect(headingPath(chunk)).not.toContain("null");
    expect(headingPath(chunk)).not.toContain(" ›  › ");
  });
});

describe("buildDocumentText", () => {
  it("returns the full string with all fields present", () => {
    const chunk = {
      documentTitle: "Document Title",
      partTitle: "Part Title",
      heading: "Heading",
      text: "Some text content.",
    };

    const result = buildDocumentText(chunk);
    expect(result).toContain("title: Document Title › Part Title › Heading");
    expect(result).toContain("text: Some text content.");
  });
});
