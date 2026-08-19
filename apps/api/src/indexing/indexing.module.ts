import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Chunk } from "../chunking/chunk.entity";
import { EmbeddingsModule } from "../embeddings/embeddings.module";
import { IndexingController } from "./indexing.controller";
import { IndexingService } from "./indexing.service";

@Module({
  imports: [TypeOrmModule.forFeature([Chunk]), EmbeddingsModule],
  providers: [IndexingService],
  controllers: [IndexingController],
})
export class IndexingModule {}
