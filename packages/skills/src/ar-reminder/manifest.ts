import { z } from "zod";
import type { SkillManifest } from "../contract";

export const ArReminderConfigSchema = z.object({
  reminderToneHint: z.string().max(200).optional(),
});

export const manifest: SkillManifest = {
  id: "ar-reminder", name: "AR Reminder",
  description: "Finds overdue invoices and drafts a friendly payment reminder to the contact.",
  approvalExpiryHours: 72,
  configSchema: ArReminderConfigSchema,
};
