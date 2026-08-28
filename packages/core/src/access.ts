import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
} from "better-auth/plugins/organization/access";

export const statement = {
  ...defaultStatements,
  action: ["approve", "deny", "view"],
} as const;

export const ac = createAccessControl(statement);

export const ownerRole = ac.newRole({
  action: ["approve", "deny", "view"],
  ...defaultStatements,
});

export const adminRole = ac.newRole({
  action: ["approve", "deny", "view"],
  ...adminAc.statements,
});

export const operatorRole = ac.newRole({
  action: ["approve", "deny", "view"],
});

export const viewerRole = ac.newRole({ action: ["view"] });

export const orgRoles = {
  owner: ownerRole,
  admin: adminRole,
  operator: operatorRole,
  viewer: viewerRole,
} as const;

export function can(
  role: string,
  permissions: { action?: Array<"approve" | "deny" | "view"> },
): boolean {
  return role.split(",").some((assignedRole) => {
    const roleObj = orgRoles[assignedRole.trim() as keyof typeof orgRoles];
    return roleObj ? roleObj.authorize(permissions).success : false;
  });
}
