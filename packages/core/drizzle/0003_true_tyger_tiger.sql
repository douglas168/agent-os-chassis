CREATE TABLE IF NOT EXISTS "follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"skill_id" text NOT NULL,
	"due_at" timestamp NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"touch_index" integer NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "executing_since" timestamp;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "edited_draft" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "failed_step" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "failed_input" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "follow_ups_action_touch_idx" ON "follow_ups" USING btree ("action_id","touch_index");