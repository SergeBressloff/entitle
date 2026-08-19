import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChunkEmbedding1787123900607 implements MigrationInterface {
  name = "AddChunkEmbedding1787123900607";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chunks" ADD "embedding" vector(768)`);
    await queryRunner.query(`ALTER TABLE "chunks" ADD "embedding_model" text`);
    await queryRunner.query(
      `ALTER TABLE "chunks" ADD "embedded_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chunks" DROP COLUMN "embedded_at"`);
    await queryRunner.query(
      `ALTER TABLE "chunks" DROP COLUMN "embedding_model"`,
    );
    await queryRunner.query(`ALTER TABLE "chunks" DROP COLUMN "embedding"`);
  }
}
