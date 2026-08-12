import { Module } from "@nestjs/common";
import { LlmController } from "./llm.controller";
import { LlmService } from "./llm.service";

@Module({
  providers: [LlmService],
  exports: [LlmService],
  controllers: [LlmController],
})
export class LlmModule {}
