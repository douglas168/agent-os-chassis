"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

type FollowUp = { id: string; skillId: string; dueAt: string; status: string; touchIndex: number };
type CronSkill = { skillId: string; intervalMs: number; lastRun: { status: string; createdAt: string } | null };

export default function JobsPage() {
  const t = useTranslations("jobs");
  const format = useFormatter();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [cronSkills, setCronSkills] = useState<CronSkill[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs").then(async (res) => {
      if (!res.ok) {
        setError(t("error"));
        return;
      }
      const data = await res.json();
      setFollowUps(data.followUps);
      setCronSkills(data.cronSkills);
    });
  }, [t]);

  if (error) return <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("followUps")}</h2>
        <ul className="space-y-2">
          {followUps.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("followUpsEmpty")}</li>
          ) : (
            followUps.map((f) => (
              <li key={f.id} className="rounded-lg border border-border bg-card p-3 text-sm shadow-card">
                <span className="font-medium text-foreground">{f.skillId}</span> — {t(`followUpStatus.${f.status}`)} — {t("dueAt")}{format.dateTime(new Date(f.dueAt), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}
              </li>
            ))
          )}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("cronState")}</h2>
        <ul className="space-y-2">
          {cronSkills.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("cronEmpty")}</li>
          ) : cronSkills.map((c) => (
            <li key={c.skillId} className="rounded-lg border border-border bg-card p-3 text-sm shadow-card">
              <span className="font-medium text-foreground">{c.skillId}</span> — {t("everyHours", { hours: Math.round(c.intervalMs / 3_600_000) })}
              {c.lastRun ? <> — {t("lastRun")}{t(`runStatus.${c.lastRun.status}`)}</> : ` — ${t("neverRun")}`}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
