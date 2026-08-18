import { Module } from "@nestjs/common";
import { GovukApiService } from "./govuk-api.service";

@Module({
  providers: [GovukApiService],
  exports: [GovukApiService],
})
export class GovukApiModule {}
