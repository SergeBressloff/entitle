import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

turndown.use(gfm);

// 1. add a rule named "stripLinkUrls" that keeps link text and drops the href
turndown.addRule("stripLinkUrls", {
  filter: "a",
  replacement: (content) => content,
});

export function htmlToMarkdown(html: string): string {
  // 2. convert, and trim leading/trailing whitespace
  return turndown.turndown(html).trim();
}
