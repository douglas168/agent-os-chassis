"use client";
import { useEffect, useState } from "react";

type Trace = {
  id: string; skillId: string; status: string; error: string | null;
  failedStep: string | null; failedInput: unknown; createdAt: string;
};

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([]);

  useEffect(() => {
    fetch("/api/traces").then((res) => res.json()).then(setTraces);
  }, []);

  return (
    <main>
      <h1>Traces</h1>
      <ul>
        {traces.map((t) => (
          <li key={t.id}>
            <p>{t.skillId} — {t.status}{t.failedStep ? ` (failed at ${t.failedStep})` : ""}</p>
            {t.error && <pre>{t.error}</pre>}
            {/* adversarial-plan-review round 1, finding 6: failedInput was
                populated on runs (Task 7) but never rendered here — spec
                § 4 step 8 names "step, inputs, and error" as preserved. */}
            {t.failedInput != null && <pre>{JSON.stringify(t.failedInput, null, 2)}</pre>}
          </li>
        ))}
      </ul>
    </main>
  );
}
