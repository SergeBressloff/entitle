import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { GovukDocument } from "../ingest/document.entity";

@Entity("chunks")
@Index("uq_chunks_document_id_chunk_index", ["documentId", "chunkIndex"], {
  unique: true,
})
export class Chunk {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "pk_chunks",
  })
  id: string;

  @Column({ type: "uuid", name: "document_id", nullable: false })
  documentId: string;

  @ManyToOne(() => GovukDocument, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "document_id",
    foreignKeyConstraintName: "fk_chunks_document_id",
  })
  document: GovukDocument;

  @Column({ type: "integer", name: "chunk_index", nullable: false })
  chunkIndex: number;

  @Column({ type: "text", name: "source_url", nullable: false })
  sourceUrl: string;

  @Column({ type: "text", name: "document_title", nullable: false })
  documentTitle: string;

  @Column({ type: "text", name: "part_slug", nullable: true })
  partSlug: string | null;

  @Column({ type: "text", name: "part_title", nullable: true })
  partTitle: string | null;

  @Column({ type: "text", name: "heading", nullable: true })
  heading: string | null;

  @Column({ type: "text", name: "text", nullable: false })
  text: string;

  @Column({ type: "integer", name: "char_count", nullable: false })
  charCount: number;

  @Column({ type: "timestamptz", name: "public_updated_at", nullable: true })
  publicUpdatedAt: Date | null;

  @Column({ type: "text", name: "document_content_hash", nullable: false })
  documentContentHash: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;
}
