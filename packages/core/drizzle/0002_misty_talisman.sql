ALTER TABLE "documents" ALTER COLUMN "size_bytes" SET DATA TYPE integer USING "size_bytes"::integer;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "extracted_text" SET DATA TYPE tsvector USING to_tsvector('english', coalesce("extracted_text", ''));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS documents_extracted_text_idx ON documents USING GIN (extracted_text);
