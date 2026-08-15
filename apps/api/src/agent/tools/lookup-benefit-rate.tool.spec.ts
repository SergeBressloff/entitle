import { lookupBenefitRateTool } from "./lookup-benefit-rate.tool";

type LookupResult = {
  found: boolean;
  amount_gbp?: number;
  period?: string;
  tax_year?: string;
  source?: string;
  reason?: string;
};

describe("lookupBenefitRateTool", () => {
  it("returns the rate for a single claimant over 25", async () => {
    const result = (await lookupBenefitRateTool.run({
      benefit: "universal_credit",
      tax_year: "2026-27",
      claimant_type: "single_over_25",
    })) as LookupResult;

    expect(result).toEqual({
      found: true,
      amount_gbp: 400,
      period: "monthly",
      tax_year: "2026-27",
      source: "temporary_lookup_table",
    });
  });

  it("returns found:false for a missing claimant", async () => {
    const result = (await lookupBenefitRateTool.run({
      benefit: "universal_credit",
      tax_year: "2026-27",
    })) as LookupResult;

    expect(result.found).toBe(false);
    expect(result.reason).toContain("claimant_type");
  });

  it("returns found:false for a missing tax year", async () => {
    const result = (await lookupBenefitRateTool.run({
      benefit: "universal_credit",
      tax_year: "2019-20",
      claimant_type: "single_over_25",
    })) as LookupResult;

    expect(result.found).toBe(false);
    expect(result.reason).toContain("2019-20");
  });

  it("throws an error for an invalid benefit", async () => {
    await expect(
      lookupBenefitRateTool.run({ benefit: "nonsense", tax_year: "2026-27" }),
    ).rejects.toThrow(/benefit/i);
  });
});
