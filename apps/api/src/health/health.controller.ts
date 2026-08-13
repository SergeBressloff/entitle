import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from "@nestjs/terminus";
import { LlmService } from "../llm/llm.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly healthService: HealthCheckService,
    private readonly typeORMHealthIndicator: TypeOrmHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly llmService: LlmService,
  ) {}
  @Get()
  @HealthCheck()
  checkHealth() {
    return this.healthService.check([
      () => this.typeORMHealthIndicator.pingCheck("database"),
      () => this.checkLlmHealth(),
    ]);
  }
  private async checkLlmHealth() {
    const indicator = this.healthIndicatorService.check("llm");
    const result = await this.llmService.ping();
    return result.ok
      ? indicator.up()
      : indicator.down({
          message: result.message || "llama-server is not responding",
        });
  }
}
