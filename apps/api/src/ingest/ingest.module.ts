import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GovukApiModule } from "../govuk-api/govuk-api.module";
import { GovukDocument } from "./document.entity";
import { DocumentVersion } from "./document-version.entity";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([GovukDocument, DocumentVersion]),
    GovukApiModule,
  ],
  providers: [IngestService],
  controllers: [IngestController],
})
export class IngestModule {}
