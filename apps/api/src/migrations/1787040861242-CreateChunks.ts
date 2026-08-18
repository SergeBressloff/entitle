import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateChunks1787040861242 implements MigrationInterface {
  name = "CreateChunks1787040861242";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chunks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "document_id" uuid NOT NULL, "chunk_index" integer NOT NULL, "source_url" text NOT NULL, "document_title" text NOT NULL, "part_slug" text, "part_title" text, "heading" text, "text" text NOT NULL, "char_count" integer NOT NULL, "public_updated_at" TIMESTAMP WITH TIME ZONE, "document_content_hash" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_chunks" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_chunks_document_id_chunk_index" ON "chunks"  ("document_id", "chunk_index") `,
    );
    await queryRunner.query(
      `ALTER TABLE "chunks" ADD CONSTRAINT "fk_chunks_document_id" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chunks" DROP CONSTRAINT "fk_chunks_document_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_chunks_document_id_chunk_index"`,
    );
    await queryRunner.query(`DROP TABLE "chunks"`);
  }
}
