import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from "@nestjs/terminus";

@Controller("health")
export class HealthController {
  constructor(
    private readonly healthService: HealthCheckService,
    private readonly typeORMHealthIndicator: TypeOrmHealthIndicator,
  ) {}
  @Get()
  @HealthCheck()
  checkHealth() {
    return this.healthService.check([
      () => this.typeORMHealthIndicator.pingCheck("database"),
    ]);
  }
}
