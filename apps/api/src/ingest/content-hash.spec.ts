import { contentHash } from "./content-hash";

/**
 * A cut-down Content API payload, shaped like a real guide response.
 */
function payload(): Record<string, unknown> {
  return {
    content_id: "f790dc71-386e-4440-9689-31f94e7ac64d",
    base_path: "/universal-credit",
    title: "Universal Credit",
    description: "Universal Credit is replacing 6 other benefits.",
    schema_name: "guide",
    document_type: "guide",
    locale: "en",
    phase: "live",
    first_published_at: "2012-10-12T15:02:17+01:00",
    public_updated_at: "2024-10-17T10:58:14+01:00",
    updated_at: "2026-08-14T18:31:03+01:00",
    publishing_request_id: "21-1755193863.123-10.13.24.5-1234",
    withdrawn_notice: {},
    links: { organisations: [{ title: "DWP" }] },
    details: {
      parts: [
        {
          slug: "what-universal-credit-is",
          title: "What it is",
          body: "<p>A</p>",
        },
        { slug: "eligibility", title: "Eligibility", body: "<p>B</p>" },
      ],
    },
  };
}

describe("contentHash", () => {
  it("is stable for identical input", () => {
    expect(contentHash(payload())).toBe(contentHash(payload()));
  });

  it("ignores the order keys arrive in", () => {
    const original = payload();

    // Object.fromEntries rebuilds the object with the keys reversed.
    const reordered = Object.fromEntries(
      Object.entries(original).reverse(),
    ) as Record<string, unknown>;

    expect(Object.keys(reordered)).not.toEqual(Object.keys(original));
    expect(contentHash(reordered)).toBe(contentHash(original));
  });

  it("changes when the title changes", () => {
    const edited = { ...payload(), title: "Universal Credit (Scotland)" };

    expect(contentHash(edited)).not.toBe(contentHash(payload()));
  });

  it("changes when a guide part's body changes", () => {
    const edited = payload();
    const details = edited.details as { parts: { body: string }[] };
    details.parts[1].body = "<p>Different guidance</p>";

    expect(contentHash(edited)).not.toBe(contentHash(payload()));
  });

  /**
   * The one that matters. gov.uk republishes the whole estate periodically and
   * bumps `updated_at` without changing a word. If this ever fails, someone has
   * widened HASHED_FIELDS and every crawl is about to write spurious versions.
   */
  it("ignores a republish that does not touch the guidance", () => {
    const republished = {
      ...payload(),
      updated_at: "2026-09-01T09:00:00+01:00",
      publishing_request_id: "21-1756713600.000-10.13.24.5-9999",
    };

    expect(contentHash(republished)).toBe(contentHash(payload()));
  });

  it("ignores changes to the links graph", () => {
    const edited = {
      ...payload(),
      links: { organisations: [{ title: "Department for Work and Pensions" }] },
    };

    expect(contentHash(edited)).toBe(contentHash(payload()));
  });

  it("treats an absent field and an explicit null as the same", () => {
    const withNull = { ...payload(), description: null };
    const withoutKey = payload();
    delete withoutKey.description;

    expect(contentHash(withNull)).toBe(contentHash(withoutKey));
  });

  it("distinguishes reordered guide parts", () => {
    const edited = payload();
    const details = edited.details as { parts: unknown[] };
    details.parts.reverse();

    expect(contentHash(edited)).not.toBe(contentHash(payload()));
  });
});
