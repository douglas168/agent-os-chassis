import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, member, orgSkillConfig } from "@agentos/core";
import { auth } from "../lib/auth";
import { GET as listSkills } from "../app/api/skills/route";
import { PATCH as patchSkillConfig } from "../app/api/skills/[skillId]/config/route";

describe("/api/skills", () => {
  let orgId: string;
  let ownerId: string;
  let viewerId: string;
  let headers: Headers;
  let viewerHeaders: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;

    const owner = test.createUser({ email: "skills-route-owner@example.com" });
    await test.saveUser(owner);
    ownerId = owner.id;
    const org = await auth.api.createOrganization({
      body: {
        name: "Skills Route Org",
        slug: `skills-route-${crypto.randomUUID()}`,
        userId: ownerId,
      },
    });
    orgId = org!.id;
    headers = await test.getAuthHeaders({ userId: ownerId });

    const viewer = test.createUser({ email: "skills-route-viewer@example.com" });
    await test.saveUser(viewer);
    viewerId = viewer.id;
    await auth.api.addMember({
      body: { organizationId: orgId, userId: viewerId, role: "viewer" },
    });
    viewerHeaders = await test.getAuthHeaders({ userId: viewerId });
  });

  afterAll(async () => {
    await db.delete(orgSkillConfig).where(eq(orgSkillConfig.orgId, orgId));
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    const ctx = await auth.$context;
    await ctx.test.deleteUser(ownerId);
    await ctx.test.deleteUser(viewerId);
  });

  it("lists both demo skills with default enabled/config for a fresh org", async () => {
    const res = await listSkills(new Request("http://localhost/api/skills", { headers }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.map((skill: { id: string }) => skill.id).sort()).toEqual(["ar-reminder", "echo"]);
    expect(body.find((skill: { id: string }) => skill.id === "echo").enabled).toBe(true);
    expect(body.find((skill: { id: string }) => skill.id === "echo").config).toEqual({});
    expect(body.find((skill: { id: string }) => skill.id === "echo").configFields).toEqual([]);
  });

  it("rejects a config that fails the skill's own schema, and persists a valid one", async () => {
    const badRes = await patchSkillConfig(
      new Request("http://localhost/api/skills/ar-reminder/config", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ config: { reminderToneHint: 12345 } }),
      }),
      { params: Promise.resolve({ skillId: "ar-reminder" }) },
    );
    expect(badRes.status).toBe(400);

    const goodRes = await patchSkillConfig(
      new Request("http://localhost/api/skills/ar-reminder/config", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ enabled: true, config: { reminderToneHint: "formal" } }),
      }),
      { params: Promise.resolve({ skillId: "ar-reminder" }) },
    );
    expect(goodRes.status).toBe(200);

    const after = await listSkills(new Request("http://localhost/api/skills", { headers }));
    const body = await after.json();
    expect(body.find((skill: { id: string }) => skill.id === "ar-reminder").config.reminderToneHint).toBe("formal");
  });

  it("a toggle-only PATCH preserves the previously saved config", async () => {
    await patchSkillConfig(
      new Request("http://localhost/api/skills/ar-reminder/config", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ enabled: true, config: { reminderToneHint: "kept" } }),
      }),
      { params: Promise.resolve({ skillId: "ar-reminder" }) },
    );

    const toggled = await patchSkillConfig(
      new Request("http://localhost/api/skills/ar-reminder/config", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ enabled: false }),
      }),
      { params: Promise.resolve({ skillId: "ar-reminder" }) },
    );
    expect(toggled.status).toBe(200);
    const toggledBody = await toggled.json();
    expect(toggledBody.enabled).toBe(false);
    expect(toggledBody.config).toEqual({ reminderToneHint: "kept" });

    const after = await listSkills(new Request("http://localhost/api/skills", { headers }));
    const body = await after.json();
    expect(body.find((skill: { id: string }) => skill.id === "ar-reminder").config).toEqual({ reminderToneHint: "kept" });
  });

  it("a viewer can list skills but gets 403 mutating skill config", async () => {
    const viewerList = await listSkills(new Request("http://localhost/api/skills", { headers: viewerHeaders }));
    expect(viewerList.status).toBe(200);

    const viewerPatch = await patchSkillConfig(
      new Request("http://localhost/api/skills/ar-reminder/config", {
        method: "PATCH",
        headers: viewerHeaders,
        body: JSON.stringify({ enabled: false }),
      }),
      { params: Promise.resolve({ skillId: "ar-reminder" }) },
    );
    expect(viewerPatch.status).toBe(403);
  });
});
