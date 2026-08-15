import { checkEligibilityTool } from "./check-eligibility.tool";
import { lookupBenefitRateTool } from "./lookup-benefit-rate.tool";
import { RegisteredTool } from "./tool.types";

export const tools: RegisteredTool[] = [
  lookupBenefitRateTool,
  checkEligibilityTool,
];
