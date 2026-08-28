ALTER TABLE "documents" ALTER COLUMN "size_bytes" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "extracted_text" SET DATA TYPE tsvector;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS documents_extracted_text_idx ON documents USING GIN (extracted_text);
