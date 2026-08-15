import { z } from "zod";
import { defineTool } from "./tool.types";

const parameters = z.object({
  benefit: z
    .enum(["universal_credit"])
    .describe(
      "The benefit to check eligibility for. Currently supported: 'universal_credit'",
    ),
  age: z.number().int().min(16).describe("The age of the claimant in years"),
  savings_gbp: z
    .number()
    .nonnegative()
    .describe("The amount of savings the claimant has in GBP"),
  employment_status: z
    .enum(["employed", "unemployed", "self_employed", "student", "retired"])
    .describe("The employment status of the claimant"),
});

const SOURCE = "illustrative_rules_not_official";

const execute = async (args: z.infer<typeof parameters>) => {
  const { age, savings_gbp, employment_status } = args;

  const reasons: string[] = [];
  const caveats: string[] = [];

  if (age < 18) {
    reasons.push("Claimant must be at least 18 years old.");
  }

  if (employment_status === "student") {
    reasons.push(
      "Full-time students are generally not eligible, though exceptions apply.",
    );
  }

  if (savings_gbp > 16000) {
    reasons.push("Claimant's savings exceed the limit of £16,000.");
  } else if (savings_gbp > 6000) {
    caveats.push(
      "Savings between £6,000 and £16,000 reduce the award through tariff income.",
    );
  }

  if (reasons.length > 0) {
    return { eligible: false, reasons, source: SOURCE };
  }

  return { eligible: true, reasons: [], caveats, source: SOURCE };
};

export const checkEligibilityTool = defineTool({
  name: "check_eligibility",
  description:
    "Check whether someone is likely to qualify for a benefit, based on their circumstances. Use for questions about eligibility. Does not return payment amounts.",
  parameters,
  execute,
});
