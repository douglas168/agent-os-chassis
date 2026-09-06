"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

type Run = {
  id: string;
  skillId: string;
  status: string;
  failedStep: string | null;
  entityRef: { table: string; id: string } | null;
  createdAt: string;
};

export default function WorkListPage() {
  const t = useTranslations("workList");
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/work").then(async (res) => {
      if (!res.ok) {
        setError(t("error"));
        return;
      }
      setRuns(await res.json());
    });
  }, [t]);

  if (error) return <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>;

  const live = runs.filter((r) => r.status === "running" || r.status === "suspended");
  const recent = runs.filter((r) => r.status !== "running" && r.status !== "suspended");

  function RunRow({ r }: { r: Run }) {
    const content = (
      <li className="rounded-lg border border-border bg-card p-3 text-sm shadow-card">
        <span className="font-medium text-foreground">{r.skillId}</span> — {r.status}
        {r.failedStep ? ` (${t("failedAt", { step: r.failedStep })})` : ""}
      </li>
    );
    return r.entityRef ? <Link href={`/work/${r.entityRef.id}`}>{content}</Link> : content;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("live")}</h2>
        <ul className="space-y-2">
          {live.length === 0 ? <li className="text-sm text-muted-foreground">{t("liveEmpty")}</li> : live.map((r) => <RunRow key={r.id} r={r} />)}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("recent")}</h2>
        <ul className="space-y-2">
          {recent.length === 0 ? <li className="text-sm text-muted-foreground">{t("recentEmpty")}</li> : recent.map((r) => <RunRow key={r.id} r={r} />)}
        </ul>
      </section>
    </div>
  );
}
