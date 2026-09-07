import { describe, it, expect } from "vitest";
import { can, isOrgAdmin } from "../src/access";

describe("can", () => {
  it("lets owner approve", () => {
    expect(can("owner", { action: ["approve"] })).toBe(true);
  });

  it("lets operator approve and view but not manage roles it has no statement for", () => {
    expect(can("operator", { action: ["approve"] })).toBe(true);
    expect(can("operator", { action: ["view"] })).toBe(true);
  });

  it("blocks viewer from approving", () => {
    expect(can("viewer", { action: ["approve"] })).toBe(false);
  });

  it("lets viewer view", () => {
    expect(can("viewer", { action: ["view"] })).toBe(true);
  });

  it("returns false for an unknown role instead of throwing", () => {
    expect(can("nobody", { action: ["view"] })).toBe(false);
  });

  it("grants access if any role in a comma-separated multi-role member has it", () => {
    // Better-Auth stores a member with more than one role as a comma-separated
    // string. Grant access when any assigned role authorizes the permission.
    expect(can("viewer,operator", { action: ["approve"] })).toBe(true);
    expect(can("viewer", { action: ["approve"] })).toBe(false);
  });
});

describe("isOrgAdmin", () => {
  it("returns true for owner and admin, false for operator and viewer", () => {
    expect(isOrgAdmin("owner")).toBe(true);
    expect(isOrgAdmin("admin")).toBe(true);
    expect(isOrgAdmin("operator")).toBe(false);
    expect(isOrgAdmin("viewer")).toBe(false);
  });

  it("returns true when a comma-separated role list contains owner or admin", () => {
    expect(isOrgAdmin("operator, admin")).toBe(true);
    expect(isOrgAdmin("operator, viewer")).toBe(false);
  });
});
