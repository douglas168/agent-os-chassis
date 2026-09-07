"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type ConfigFieldDescriptor = {
  name: string;
  type: "string" | "number" | "boolean";
  optional: boolean;
};

type SkillRow = {
  id: string;
  name: string;
  description: string;
  hasConfig: boolean;
  configFields: ConfigFieldDescriptor[];
  enabled: boolean;
  config: Record<string, unknown>;
};

export default function SkillsPage() {
  const t = useTranslations("skills");
  const [rows, setRows] = useState<SkillRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    fetch("/api/skills")
      .then((response) => response.json())
      .then((data: SkillRow[]) => {
        setRows(data);
        setDrafts(Object.fromEntries(data.map((skill) => [skill.id, { ...skill.config }])));
      });
  }, []);

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/skills/${id}/config`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    setRows((current) => current.map((skill) => (skill.id === id ? { ...skill, enabled } : skill)));
  }

  function setField(skillId: string, fieldName: string, value: unknown) {
    setDrafts((current) => ({
      ...current,
      [skillId]: { ...current[skillId], [fieldName]: value },
    }));
  }

  async function saveConfig(id: string) {
    const config = drafts[id] ?? {};
    const response = await fetch(`/api/skills/${id}/config`, {
      method: "PATCH",
      body: JSON.stringify({ config }),
    });
    if (response.ok) {
      setRows((current) => current.map((skill) => (skill.id === id ? { ...skill, config } : skill)));
    }
  }

  return (
    <ul className="space-y-4">
      {rows.map((skill) => (
        <li key={skill.id} className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{skill.name}</p>
              <p className="text-xs text-muted-foreground">{skill.description}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              {t("enabled")}
              <input
                type="checkbox"
                checked={skill.enabled}
                onChange={(event) => toggle(skill.id, event.target.checked)}
              />
            </label>
          </div>

          {skill.hasConfig && (
            <div className="space-y-2">
              {skill.configFields.map((field) => {
                const value = drafts[skill.id]?.[field.name];
                const label = `${skill.name} ${field.name}`;

                if (field.type === "boolean") {
                  return (
                    <label key={field.name} className="flex items-center gap-2 text-sm text-foreground">
                      {field.name}
                      <input
                        type="checkbox"
                        aria-label={label}
                        checked={Boolean(value)}
                        onChange={(event) => setField(skill.id, field.name, event.target.checked)}
                      />
                    </label>
                  );
                }

                return (
                  <label key={field.name} className="block text-sm text-foreground">
                    {field.name}
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      aria-label={label}
                      value={(value as string | number | undefined) ?? ""}
                      onChange={(event) => setField(
                        skill.id,
                        field.name,
                        field.type === "number" ? event.target.valueAsNumber : event.target.value,
                      )}
                      className="mt-0.5 block w-full rounded-md border border-border bg-transparent p-2 text-sm text-foreground"
                    />
                  </label>
                );
              })}
              <button
                onClick={() => saveConfig(skill.id)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              >
                {t("save")}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
