import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { SKILLS } from "@agentos/skills";
import { db } from "../db/client";
import { createContactsRepo } from "../repositories/contacts";
import { createDocumentsRepo } from "../repositories/documents";
import { createRunsRepo } from "../repositories/runs";
import { createActionsRepo } from "../repositories/actions";
import { createMessagesRepo } from "../repositories/messages";
import { createOrgSkillConfigRepo } from "../repositories/org-skill-config";
import { runSkillForMessage } from "./run-skill";
import type { OrgContext } from "../context";

export function createSearchContactsTool(ctx: OrgContext) {
  return createTool({
    id: "searchContacts",
    description: "Search this organization's contacts by name, company, or email address.",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({
      results: z.array(z.object({
        id: z.string(),
        name: z.string(),
        company: z.string().nullable(),
      })),
    }),
    execute: async ({ query }: { query: string }) => {
      const all = await createContactsRepo(db).listForOrg(ctx);
      const needle = query.toLowerCase();
      const results = all
        .filter((contact) => {
          const emails = Array.isArray(contact.emails) ? contact.emails : [];
          return contact.name.toLowerCase().includes(needle)
            || (contact.company?.toLowerCase().includes(needle) ?? false)
            || emails.some((email) => String(email).toLowerCase().includes(needle));
        })
        .map((contact) => ({
          id: contact.id,
          name: contact.name,
          company: contact.company,
        }));
      return { results };
    },
  });
}

export function createSearchDocumentsTool(ctx: OrgContext) {
  return createTool({
    id: "searchDocuments",
    description: "Search this organization's documents by their extracted text.",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({
      results: z.array(z.object({
        id: z.string(),
        title: z.string(),
        mime: z.string(),
      })),
    }),
    execute: async ({ query }: { query: string }) => {
      const found = await createDocumentsRepo(db).search(ctx, query);
      return {
        results: found.map((document) => ({
          id: document.id,
          title: document.title,
          mime: document.mime,
        })),
      };
    },
  });
}

export function createListRecentRunsTool(ctx: OrgContext) {
  return createTool({
    id: "listRecentRuns",
    description: "List this organization's most recent skill runs, newest first.",
    inputSchema: z.object({
      limit: z.number().int().positive().max(20).optional(),
    }),
    outputSchema: z.object({
      results: z.array(z.object({
        id: z.string(),
        skillId: z.string(),
        status: z.string(),
        createdAt: z.string(),
      })),
    }),
    execute: async ({ limit }: { limit?: number }) => {
      const all = await createRunsRepo(db).listForOrg(ctx);
      const results = all.slice(0, limit ?? 5).map((run) => ({
        id: run.id,
        skillId: run.skillId,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
      }));
      return { results };
    },
  });
}

export function createRunSkillTool(ctx: OrgContext) {
  return createTool({
    id: "runSkill",
    description:
      "Run an enabled skill on the operator's behalf, from a plain-language instruction. " +
      "This only creates a pending Action for a human to approve — it never sends anything by itself.",
    inputSchema: z.object({
      skillId: z.string(),
      message: z.string(),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      runId: z.string().optional(),
      actionId: z.string().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ skillId, message }: { skillId: string; message: string }) => {
      const skill = SKILLS.find((candidate) => candidate.manifest.id === skillId);
      if (!skill) return { ok: false, error: `unknown skill "${skillId}"` };

      const config = await createOrgSkillConfigRepo(db).findOne(ctx, skillId);
      if (config?.enabled === false) {
        return {
          ok: false,
          error: `skill "${skillId}" is disabled for this organization`,
        };
      }

      const inbound = {
        channel: "chat",
        direction: "in" as const,
        from: ctx.userId,
        to: "chat",
        body: message,
        providerMessageId: crypto.randomUUID(),
        raw: null,
      };
      const messageRow = await createMessagesRepo(db).create(ctx, inbound);
      const { runId: mastraRunId, actionId } = await runSkillForMessage(
        ctx,
        skill,
        inbound,
        messageRow.id,
      );
      const runRow = await createRunsRepo(db).findByMastraRunId(ctx, mastraRunId);
      if (!runRow) {
        return { ok: false, error: "skill run was not persisted" };
      }
      return { ok: true, runId: runRow.id, actionId };
    },
  });
}

export function createPresentPendingActionTool(ctx: OrgContext) {
  return createTool({
    id: "presentPendingAction",
    description: "Fetch a pending Action by id so it can be shown to the operator as an approval card.",
    inputSchema: z.object({ actionId: z.string() }),
    outputSchema: z.object({
      found: z.boolean(),
      action: z.object({
        id: z.string(),
        runId: z.string(),
        skillId: z.string(),
        draft: z.record(z.unknown()),
        editedDraft: z.record(z.unknown()).nullable(),
        status: z.string(),
        expiresAt: z.string(),
        editableFields: z.array(z.string()),
      }).nullable(),
    }),
    execute: async ({ actionId }: { actionId: string }) => {
      const row = await createActionsRepo(db).findById(ctx, actionId);
      if (!row) return { found: false, action: null };

      const skill = SKILLS.find((candidate) => candidate.manifest.id === row.skillId);
      return {
        found: true,
        action: {
          id: row.id,
          runId: row.runId,
          skillId: row.skillId,
          draft: row.draft as Record<string, unknown>,
          editedDraft: row.editedDraft as Record<string, unknown> | null,
          status: row.status,
          expiresAt: row.expiresAt.toISOString(),
          editableFields: [...(skill?.editableFields ?? [])],
        },
      };
    },
  });
}

export function buildChatAgent(ctx: OrgContext): Agent {
  return new Agent({
    id: "chat-agent",
    name: "chat-agent",
    instructions:
      "You are the AgentOS chat operator assistant for this organization. " +
      "You can search contacts, search documents, list recent skill runs, run an " +
      "enabled skill from a plain-language instruction, and present a pending " +
      "Action for the operator to review. You never send anything directly — " +
      "only a human operator approves and sends, by deciding on the approval " +
      "card the presentPendingAction tool surfaces.",
    model: {
      id: `openai-compatible/${process.env.LLM_MODEL}`,
      url: process.env.LLM_BASE_URL!,
      apiKey: process.env.LLM_API_KEY!,
    },
    tools: {
      searchContacts: createSearchContactsTool(ctx),
      searchDocuments: createSearchDocumentsTool(ctx),
      listRecentRuns: createListRecentRunsTool(ctx),
      runSkill: createRunSkillTool(ctx),
      presentPendingAction: createPresentPendingActionTool(ctx),
    },
  });
}
