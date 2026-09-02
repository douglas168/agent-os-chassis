CREATE TABLE IF NOT EXISTS "skill_ar_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"due_at" timestamp NOT NULL,
	"stage" text DEFAULT 'issued' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
