import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { LlmModule } from "../llm/llm.module";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
  imports: [TerminusModule, LlmModule],
})
export class HealthModule {}
