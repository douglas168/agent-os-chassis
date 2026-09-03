import type { EntityView } from "../contract";

export const entity: EntityView = {
  table: "skill_ar_invoices",
  stages: [
    { key: "issued", label: "Issued" }, { key: "due", label: "Due" }, { key: "reminded", label: "Reminded" },
    { key: "escalated", label: "Escalated" }, { key: "paid", label: "Paid" }, { key: "declined", label: "Declined" },
  ],
  present: (row) => ({
    title: `Invoice ${row.invoiceNumber as string}`,
    subtitle: row.contactName as string | undefined,
    fields: [
      { label: "Amount", value: `$${((row.amountCents as number) / 100).toFixed(2)}` },
      { label: "Due", value: new Date(row.dueAt as string).toISOString().slice(0, 10) },
    ],
    currentStage: row.stage as string,
  }),
};
