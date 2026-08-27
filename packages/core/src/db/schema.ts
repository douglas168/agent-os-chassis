import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  channel: text("channel").notNull(), // 'mock' | 'email' | 'line' | 'manual'
  direction: text("direction").notNull(), // 'in' | 'out'
  providerMessageId: text("provider_message_id").notNull(),
  from: text("from_addr").notNull(),
  to: text("to_addr").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  skillId: text("skill_id").notNull(),
  messageId: uuid("message_id").references(() => messages.id),
  mastraRunId: text("mastra_run_id").notNull(),
  status: text("status").notNull().default("running"), // running|suspended|done|failed
  intent: jsonb("intent"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const actions = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  runId: uuid("run_id").notNull().references(() => runs.id),
  skillId: text("skill_id").notNull(),
  kind: text("kind").notNull(),
  draft: jsonb("draft").notNull(),
  status: text("status").notNull().default("pending"), // pending|approved|denied|executing|done|failed
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  actor: text("actor").notNull(), // user id | 'system' | 'skill:<id>'
  event: text("event").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
