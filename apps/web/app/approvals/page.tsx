"use client";
import { useEffect, useState } from "react";

type Action = { id: string; runId: string; skillId: string; draft: any; status: string };

export default function ApprovalsPage() {
  const [actions, setActions] = useState<Action[]>([]);

  async function refresh() {
    const res = await fetch("/api/actions");
    setActions(await res.json());
  }

  useEffect(() => { refresh(); }, []);

  async function decide(id: string, decision: "approved" | "denied") {
    await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ decision }),
    });
    await refresh();
  }

  return (
    <main>
      <h1>Approvals</h1>
      <ul>
        {actions.map((a) => (
          <li key={a.id}>
            <p>{a.skillId}: {JSON.stringify(a.draft)}</p>
            <button onClick={() => decide(a.id, "approved")}>Approve</button>
            <button onClick={() => decide(a.id, "denied")}>Deny</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
