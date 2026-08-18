import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDocuments1786955223653 implements MigrationInterface {
  name = "CreateDocuments1786955223653";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content_id" uuid NOT NULL, "base_path" text NOT NULL, "title" text NOT NULL, "description" text, "schema_name" text NOT NULL, "document_type" text NOT NULL, "locale" text NOT NULL, "phase" text, "withdrawn" boolean NOT NULL DEFAULT false, "first_published_at" TIMESTAMP WITH TIME ZONE, "public_updated_at" TIMESTAMP WITH TIME ZONE, "source_updated_at" TIMESTAMP WITH TIME ZONE, "content_hash" text NOT NULL, "raw" jsonb NOT NULL, "first_fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "pk_documents" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_documents_content_id" ON "documents"  ("content_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "document_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "document_id" uuid NOT NULL, "content_hash" text NOT NULL, "public_updated_at" TIMESTAMP WITH TIME ZONE, "raw" jsonb NOT NULL, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_document_versions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_document_versions_document_id_fetched_at" ON "document_versions"  ("document_id", "fetched_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "document_versions" ADD CONSTRAINT "fk_document_versions_document_id" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_versions" DROP CONSTRAINT "fk_document_versions_document_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_document_versions_document_id_fetched_at"`,
    );
    await queryRunner.query(`DROP TABLE "document_versions"`);
    await queryRunner.query(`DROP INDEX "public"."uq_documents_content_id"`);
    await queryRunner.query(`DROP TABLE "documents"`);
  }
}
