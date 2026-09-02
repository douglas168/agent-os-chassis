"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type EntityViewData = {
  id: string; skillId: string; title: string; subtitle?: string;
  fields: { label: string; value: string }[];
  stages: { key: string; label: string }[]; currentStage: string;
  runs: { id: string; status: string; createdAt: string }[];
};

export default function WorkEntityPage() {
  const params = useParams<{ entityId: string }>();
  const [view, setView] = useState<EntityViewData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/work/${params.entityId}`).then(async (res) => {
      if (res.status === 404) { setNotFound(true); return; }
      setView(await res.json());
    });
  }, [params.entityId]);

  if (notFound) return <main><h1>Not found</h1></main>;
  if (!view) return <main><p>Loading…</p></main>;

  return (
    <main>
      <h1>{view.title}</h1>
      {view.subtitle && <p>{view.subtitle}</p>}
      <ol>
        {view.stages.map((s) => (
          <li key={s.key}>{s.key === view.currentStage ? <strong>{s.label}</strong> : s.label}</li>
        ))}
      </ol>
      <ul>
        {view.fields.map((f) => (<li key={f.label}>{f.label}: {f.value}</li>))}
      </ul>
      <h2>Runs</h2>
      <ul>
        {view.runs.map((r) => (<li key={r.id}>{r.status} — {r.createdAt}</li>))}
      </ul>
    </main>
  );
}
