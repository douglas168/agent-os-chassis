"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type LlmConfig = {
  baseUrl: string | null;
  model: string | null;
  apiKeyConfigured: boolean;
};

type TestResult = {
  ok: boolean;
  detail: string;
};

export default function AdminLlmPage() {
  const t = useTranslations("adminLlm");
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getErrorMessage(res: Response) {
    const body: unknown = await res.json().catch(() => null);
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
    return t("error");
  }

  async function load() {
    try {
      const res = await fetch("/api/admin/llm");
      if (!res.ok) {
        setError(await getErrorMessage(res));
        return;
      }

      setConfig((await res.json()) as LlmConfig);
      setError(null);
    } catch {
      setError(t("error"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/llm/test-connection", { method: "POST" });
      if (!res.ok) {
        setError(await getErrorMessage(res));
        return;
      }
      setResult((await res.json()) as TestResult);
      setError(null);
    } catch {
      setResult({ ok: false, detail: t("error") });
    } finally {
      setTesting(false);
    }
  }

  if (error) {
    return <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>;
  }

  if (!config) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("provider")}</h2>
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">{t("baseUrl")}:</span> {config.baseUrl ?? t("notConfigured")}
      </p>
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">{t("model")}:</span> {config.model ?? t("notConfigured")}
      </p>
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">{t("apiKey")}:</span> {config.apiKeyConfigured ? t("configured") : t("notConfigured")}
      </p>
      <button
        type="button"
        onClick={() => void runTest()}
        disabled={testing}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {t("test")}
      </button>
      {result && (
        <p className={result.ok ? "text-sm text-success" : "text-sm text-danger"}>{result.detail}</p>
      )}
    </section>
  );
}
