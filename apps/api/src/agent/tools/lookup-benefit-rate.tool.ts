import { z } from "zod";
import { defineTool } from "./tool.types";

const parameters = z.object({
  benefit: z
    .enum(["universal_credit", "pip"])
    .describe(
      "The benefit to look up. Currently supported: 'universal_credit', 'pip'",
    ),
  tax_year: z.string().describe("Tax year in the form 2026-27"),
  claimant_type: z
    .enum(["single_under_25", "single_over_25", "couple"])
    .optional()
    .describe(
      "The type of claimant. Currently supported: 'single_under_25', 'single_over_25', 'couple'",
    ),
});

const benefitAmounts: Record<string, Record<string, Record<string, number>>> = {
  universal_credit: {
    "2026-27": {
      single_under_25: 300,
      single_over_25: 400,
      couple: 500,
    },
  },
  pip: {
    "2026-27": {
      single_under_25: 200,
      single_over_25: 300,
      couple: 400,
    },
  },
};

const execute = async (args: z.infer<typeof parameters>) => {
  const { benefit, tax_year, claimant_type } = args;

  if (!benefitAmounts[benefit]) {
    return { found: false, reason: `Benefit ${benefit} not found.` };
  }

  if (!benefitAmounts[benefit][tax_year]) {
    return {
      found: false,
      reason: `Tax year ${tax_year} not found for benefit ${benefit}.`,
    };
  }

  if (!claimant_type) {
    return {
      found: false,
      reason:
        "claimant_type is required — ask whether they are single under 25, single 25 or over, or part of a couple",
    };
  }

  const amount_gbp = benefitAmounts[benefit][tax_year][claimant_type];

  if (amount_gbp === undefined) {
    return {
      found: false,
      reason: `Amount for benefit ${benefit}, tax year ${tax_year}, and claimant type ${claimant_type} not found.`,
    };
  }

  return {
    found: true,
    amount_gbp,
    period: "monthly",
    tax_year,
    source: "temporary_lookup_table",
  };
};

export const lookupBenefitRateTool = defineTool({
  name: "lookup_benefit_rate",
  description:
    "Look up the current statutory rate for a UK benefit. Use this for any question about benefit amounts or how much someone would receive. Do not answer from memory; rates change every tax year.",
  parameters,
  execute,
});
