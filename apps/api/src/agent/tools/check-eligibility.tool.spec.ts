import { checkEligibilityTool } from "./check-eligibility.tool";

type EligibilityResult = {
  eligible: boolean;
  reasons?: string[];
  caveats?: string[];
  source?: string;
};

describe("checkEligibilityTool", () => {
  it("returns eligible:true for a claimant under the savings limit", async () => {
    const result = (await checkEligibilityTool.run({
      benefit: "universal_credit",
      age: 30,
      savings_gbp: 5000,
      employment_status: "employed",
    })) as EligibilityResult;

    expect(result.eligible).toBe(true);
  });

  it("returns eligible:false for a claimant under 18", async () => {
    const result = (await checkEligibilityTool.run({
      benefit: "universal_credit",
      age: 17,
      savings_gbp: 5000,
      employment_status: "employed",
    })) as EligibilityResult;

    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("at least 18")]),
    );
  });

  it("returns eligible:false for a claimant over the savings limit", async () => {
    const result = (await checkEligibilityTool.run({
      benefit: "universal_credit",
      age: 30,
      savings_gbp: 17000,
      employment_status: "employed",
    })) as EligibilityResult;

    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("£16,000")]),
    );
  });

  it("returns eligible:true with caveats for a claimant with savings between £6,000 and £16,000", async () => {
    const result = (await checkEligibilityTool.run({
      benefit: "universal_credit",
      age: 30,
      savings_gbp: 10000,
      employment_status: "employed",
    })) as EligibilityResult;

    expect(result.eligible).toBe(true);
    expect(result.caveats).toEqual(
      expect.arrayContaining([expect.stringContaining("reduce")]),
    );
  });

  it("returns eligible:false for a full-time student", async () => {
    const result = (await checkEligibilityTool.run({
      benefit: "universal_credit",
      age: 30,
      savings_gbp: 5000,
      employment_status: "student",
    })) as EligibilityResult;

    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("student")]),
    );
  });

  it("reasons has length 2 for a claimant under 18 and a full-time student", async () => {
    const result = (await checkEligibilityTool.run({
      benefit: "universal_credit",
      age: 17,
      savings_gbp: 5000,
      employment_status: "student",
    })) as EligibilityResult;

    expect(result.eligible).toBe(false);
    expect(result.reasons?.length).toEqual(2);
  });

  it("throws an error for an invalid benefit", async () => {
    await expect(
      checkEligibilityTool.run({
        benefit: "nonsense",
        age: 30,
        savings_gbp: 5000,
        employment_status: "employed",
      }),
    ).rejects.toThrow(/benefit/i);
  });

  it("throws an error if savings_gbp is a string instead of a number", async () => {
    await expect(
      checkEligibilityTool.run({
        benefit: "universal_credit",
        age: 30,
        savings_gbp: "5000" as unknown as number,
        employment_status: "employed",
      }),
    ).rejects.toThrow(/savings_gbp/i);
  });
});
