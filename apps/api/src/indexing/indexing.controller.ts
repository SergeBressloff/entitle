import { Controller, Get, Post, Query } from "@nestjs/common";
import { IndexingService } from "./indexing.service";

@Controller("indexing")
export class IndexingController {
  constructor(private readonly indexingService: IndexingService) {}

  @Post("run")
  async run(@Query("force") force?: string) {
    return await this.indexingService.embedPending(force === "true");
  }

  @Get("count")
  async count() {
    return await this.indexingService.countEmbedded();
  }
}
