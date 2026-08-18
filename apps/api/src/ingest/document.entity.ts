import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("documents")
export class GovukDocument {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "pk_documents" })
  id: string;

  @Index("uq_documents_content_id", { unique: true })
  @Column({ type: "uuid", name: "content_id" })
  contentId: string;

  @Column({ type: "text", name: "base_path" })
  basePath: string;

  @Column({ type: "text", name: "title" })
  title: string;

  @Column({ type: "text", name: "description", nullable: true })
  description: string | null;

  @Column({ type: "text", name: "schema_name" })
  schemaName: string;

  @Column({ type: "text", name: "document_type" })
  documentType: string;

  @Column({ type: "text", name: "locale" })
  locale: string;

  @Column({ type: "text", name: "phase", nullable: true })
  phase: string | null;

  @Column({ type: "boolean", name: "withdrawn", default: false })
  withdrawn: boolean;

  @Column({ type: "timestamptz", name: "first_published_at", nullable: true })
  firstPublishedAt: Date | null;

  @Column({ type: "timestamptz", name: "public_updated_at", nullable: true })
  publicUpdatedAt: Date | null;

  @Column({ type: "timestamptz", name: "source_updated_at", nullable: true })
  sourceUpdatedAt: Date | null;

  @Column({ type: "text", name: "content_hash" })
  contentHash: string;

  @Column({ type: "jsonb", name: "raw" })
  raw: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz", name: "first_fetched_at" })
  firstFetchedAt: Date;

  @Column({ type: "timestamptz", name: "last_fetched_at" })
  lastFetchedAt: Date;
}
