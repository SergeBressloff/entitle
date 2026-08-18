import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GovukDocument } from "../ingest/document.entity";
import { Chunk } from "./chunk.entity";
import { ChunkingController } from "./chunking.controller";
import { ChunkingService } from "./chunking.service";

@Module({
  imports: [TypeOrmModule.forFeature([Chunk, GovukDocument])],
  providers: [ChunkingService],
  controllers: [ChunkingController],
})
export class ChunkingModule {}
