import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { GovukDocument } from "./document.entity";

@Entity("document_versions")
@Index("idx_document_versions_document_id_fetched_at", [
  "documentId",
  "fetchedAt",
])
export class DocumentVersion {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "pk_document_versions",
  })
  id: string;

  @Column({ type: "uuid", name: "document_id" })
  documentId: string;

  @ManyToOne(() => GovukDocument, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({
    name: "document_id",
    foreignKeyConstraintName: "fk_document_versions_document_id",
  })
  document: GovukDocument;

  @Column({ type: "text", name: "content_hash" })
  contentHash: string;

  @Column({ type: "timestamptz", name: "public_updated_at", nullable: true })
  publicUpdatedAt: Date | null;

  @Column({ type: "jsonb", name: "raw" })
  raw: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz", name: "fetched_at" })
  fetchedAt: Date;
}
