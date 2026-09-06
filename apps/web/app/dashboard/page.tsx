"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Dashboard = {
  pendingApprovals: number;
  actionsThisWeek: number;
  followUpsDue: number;
  actionsExpired: number;
  outcomes: { approved: number; denied: number };
};

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then(async (res) => {
      if (!res.ok) {
        setError(t("error"));
        return;
      }
      setData(await res.json());
    });
  }, [t]);

  if (error) return <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  const kpis = [
    { label: t("pendingApprovals"), value: data.pendingApprovals },
    { label: t("actionsThisWeek"), value: data.actionsThisWeek },
    { label: t("followUpsDue"), value: data.followUpsDue },
    { label: t("actionsExpired"), value: data.actionsExpired },
    { label: t("approved"), value: data.outcomes.approved },
    { label: t("denied"), value: data.outcomes.denied },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-4 shadow-card">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
