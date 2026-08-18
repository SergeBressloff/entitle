import { Controller, Get, Post, Query } from "@nestjs/common";
import { ChunkingService } from "./chunking.service";

@Controller("chunking")
export class ChunkingController {
  constructor(private readonly chunkingService: ChunkingService) {}

  @Post("run")
  async runChunking(@Query("force") force?: string) {
    return await this.chunkingService.chunkAll(force === "true");
  }

  @Get("count")
  async countChunks() {
    const count = await this.chunkingService.countChunks();
    return { count };
  }
}
