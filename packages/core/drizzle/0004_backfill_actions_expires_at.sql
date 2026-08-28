UPDATE "actions" SET "expires_at" = "created_at" + interval '72 hours' WHERE "expires_at" IS NULL;
