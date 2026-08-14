import { Module } from "@nestjs/common";
import { LlmModule } from "../llm/llm.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";

@Module({
  providers: [AgentService],
  imports: [LlmModule],
  controllers: [AgentController],
})
export class AgentModule {}
