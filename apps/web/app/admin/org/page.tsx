"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Channels = { email: boolean; line: boolean };

type OrgResponse = {
  name?: string | null;
  locale?: string | null;
  channels?: Partial<Channels>;
};

export default function AdminOrgPage() {
  const t = useTranslations("adminOrg");
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("en");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channels>({ email: false, line: false });

  async function getErrorMessage(res: Response) {
    const body: unknown = await res.json().catch(() => null);
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
    return t("error");
  }

  async function load() {
    try {
      const res = await fetch("/api/admin/org");
      if (!res.ok) {
        setError(await getErrorMessage(res));
        return;
      }

      const body = (await res.json()) as OrgResponse;
      setError(null);
      setName(body.name ?? "");
      setLocale(body.locale ?? "en");
      setChannels({ email: Boolean(body.channels?.email), line: Boolean(body.channels?.line) });
    } catch {
      setError(t("error"));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaved(false);
    try {
      const res = await fetch("/api/admin/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, locale }),
      });
      if (!res.ok) {
        setError(await getErrorMessage(res));
        return;
      }
      setError(null);
      setSaved(true);
    } catch {
      setError(t("error"));
    }
  }

  if (error) {
    return <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>;
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  const channelRows: { key: keyof Channels; configured: boolean }[] = [
    { key: "email", configured: channels.email },
    { key: "line", configured: channels.line },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("orgSettings")}</h2>
        <label className="block text-xs text-muted-foreground" htmlFor="org-name">{t("name")}</label>
        <input
          id="org-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm"
        />
        <label className="block text-xs text-muted-foreground" htmlFor="org-locale">{t("locale")}</label>
        <select
          id="org-locale"
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
        >
          <option value="en">{t("english")}</option>
          <option value="zh-TW">{t("traditionalChinese")}</option>
        </select>
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          {t("save")}
        </button>
        {saved && <p className="text-xs text-success">{t("saved")}</p>}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("channels")}</h2>
        <ul className="space-y-1 text-sm text-foreground">
          {channelRows.map((channel) => (
            <li key={channel.key}>
              {t(channel.key)}: {channel.configured ? t("configured") : t("notConfigured")}
            </li>
          ))}
        </ul>
        <form title={t("channelFormDisabledReason")}>
          <fieldset disabled className="space-y-2">
            <legend className="sr-only">{t("channelCredentials")}</legend>
            <div>
              <label className="block text-xs text-muted-foreground" htmlFor="channel-email">{t("email")}</label>
              <input
                id="channel-email"
                aria-label={t("email")}
                placeholder={t("channelFormDisabledReason")}
                className="w-full rounded-md border border-border bg-muted px-2 py-1 text-sm text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground" htmlFor="channel-line">{t("line")}</label>
              <input
                id="channel-line"
                aria-label={t("line")}
                placeholder={t("channelFormDisabledReason")}
                className="w-full rounded-md border border-border bg-muted px-2 py-1 text-sm text-muted-foreground"
              />
            </div>
          </fieldset>
        </form>
      </section>
    </div>
  );
}
