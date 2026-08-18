import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import { IngestService } from "./ingest.service";

@Controller("ingest")
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Get("count")
  async countDocuments() {
    const count = await this.ingestService.countDocuments();
    return { count };
  }

  @Get("preview")
  async preview(@Query("path") path?: string) {
    if (!path) {
      throw new BadRequestException(
        "Pass a gov.uk base path, e.g. ?path=/universal-credit",
      );
    }

    return await this.ingestService.previewDocument(path);
  }

  @Post("document")
  async ingestDocument(@Query("path") path?: string) {
    if (!path) {
      throw new BadRequestException("Pass ?path=/universal-credit");
    }

    return await this.ingestService.ingestDocument(path);
  }

  @Get("search")
  async search(@Query("query") query?: string, @Query("count") count?: string) {
    if (!query) {
      throw new BadRequestException("Pass ?query=...");
    }

    const countNumber = Number(count);

    return await this.ingestService.searchPaths(query, countNumber);
  }

  @Post("run")
  async run(@Query("query") query?: string, @Query("count") count?: string) {
    if (!query) {
      throw new BadRequestException(
        "Pass ?query=universal+credit+eligibility&count=10",
      );
    }

    const countNumber = Number(count ?? "10");
    if (!Number.isInteger(countNumber) || countNumber < 1) {
      throw new BadRequestException("count must be a positive whole number");
    }

    return await this.ingestService.ingestSearch(query, countNumber);
  }
}
