import type { SkillManifest } from "../contract";

export const manifest: SkillManifest = {
  id: "ar-reminder", name: "AR Reminder",
  description: "Finds overdue invoices and drafts a friendly payment reminder to the contact.",
  approvalExpiryHours: 72,
};
