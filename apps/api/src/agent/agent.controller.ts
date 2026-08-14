import { Body, Controller, Post } from "@nestjs/common";
import { AgentService } from "./agent.service";

@Controller("agent")
export class AgentController {
  constructor(private readonly agentService: AgentService) {}
  @Post("ask")
  async ask(@Body() body: { question: string }) {
    const answer = await this.agentService.ask(body.question);
    return { answer };
  }
}
