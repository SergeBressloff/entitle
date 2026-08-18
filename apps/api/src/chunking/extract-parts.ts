import { z } from "zod";
import { GuideDetailsSchema } from "../govuk-api/govuk-api.types";

export interface DocumentPart {
  slug: string | null;
  title: string | null;
  html: string;
}

const BodyDetailsSchema = z.object({ body: z.string() });

export function extractParts(
  schemaName: string,
  details: unknown,
): DocumentPart[] {
  // 1. schemaName === "guide"  → GuideDetailsSchema, map each part to a DocumentPart
  if (schemaName === "guide") {
    const guide = GuideDetailsSchema.safeParse(details);

    if (guide.success) {
      return guide.data.parts.map((part) => ({
        slug: part.slug,
        title: part.title,
        html: part.body,
      }));
    }

    return [];
  }

  // 2. otherwise → BodyDetailsSchema, return one part with slug and title null
  const body = BodyDetailsSchema.safeParse(details);

  if (body.success) {
    return [
      {
        slug: null,
        title: null,
        html: body.data.body,
      },
    ];
  }

  // 3. if neither shape matches → return []
  return [];
}
