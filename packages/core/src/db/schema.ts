import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, customType } from "drizzle-orm/pg-core";
import { organization } from "./auth-schema";

export * from "./auth-schema";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  channel: text("channel").notNull(),
  direction: text("direction").notNull(),
  providerMessageId: text("provider_message_id").notNull(),
  from: text("from_addr").notNull(),
  to: text("to_addr").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  raw: jsonb("raw"),
  // Spec § 6 lists `contact_id?` on messages — nullable because contact-matching
  // logic doesn't exist yet (Plan 3, engine depth). The column exists now so
  // this file doesn't need a second migration touch once matching is built.
  contactId: uuid("contact_id").references(() => contacts.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  skillId: text("skill_id").notNull(),
  messageId: uuid("message_id").references(() => messages.id),
  mastraRunId: text("mastra_run_id").notNull(),
  status: text("status").notNull().default("running"),
  intent: jsonb("intent"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const actions = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  runId: uuid("run_id").notNull().references(() => runs.id),
  skillId: text("skill_id").notNull(),
  kind: text("kind").notNull(),
  draft: jsonb("draft").notNull(),
  status: text("status").notNull().default("pending"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  actor: text("actor").notNull(),
  event: text("event").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Spec § 6 — remaining Plan 2 tables.
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  name: text("name").notNull(),
  emails: jsonb("emails").notNull().default([]),
  lineUserId: text("line_user_id"),
  company: text("company"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  title: text("title").notNull(),
  source: text("source").notNull(), // 'upload' | 'message-attachment'
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  extractedText: tsvector("extracted_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orgSkillConfig = pgTable("org_skill_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  skillId: text("skill_id").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
