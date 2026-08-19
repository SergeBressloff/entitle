import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AgentModule } from "./agent/agent.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ChunkingModule } from "./chunking/chunking.module";
import { EmbeddingsModule } from "./embeddings/embeddings.module";
import { HealthModule } from "./health/health.module";
import { IndexingModule } from "./indexing/indexing.module";
import { IngestModule } from "./ingest/ingest.module";
import { LlmModule } from "./llm/llm.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        url: configService.get<string>("DATABASE_URL"),
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    HealthModule,
    LlmModule,
    AgentModule,
    IngestModule,
    ChunkingModule,
    EmbeddingsModule,
    IndexingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
