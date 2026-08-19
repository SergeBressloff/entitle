import { Module } from "@nestjs/common";
import { EmbeddingApiService } from "./embedding-api.service";

@Module({
  providers: [EmbeddingApiService],
  exports: [EmbeddingApiService],
})
export class EmbeddingsModule {}
