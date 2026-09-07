"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { orgRoles } from "@agentos/core/src/access";

type Role = keyof typeof orgRoles;

type Member = {
  id: string;
  role: string;
  user: { email: string };
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
};

type MembersResponse = {
  members: Member[];
  invitations: Invitation[];
};

const roles = Object.keys(orgRoles) as Role[];

export default function AdminUsersPage() {
  const t = useTranslations("adminUsers");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function roleLabel(role: string) {
    return role in orgRoles ? t(`roles.${role as Role}`) : role;
  }

  async function getErrorMessage(res: Response) {
    const body: unknown = await res.json().catch(() => null);
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
    return t("error");
  }

  async function refresh() {
    try {
      const res = await fetch("/api/admin/members");
      if (!res.ok) {
        setError(await getErrorMessage(res));
        return;
      }

      const body = (await res.json()) as MembersResponse;
      setError(null);
      setMembers(body.members);
      setInvitations(body.invitations);
    } catch {
      setError(t("error"));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function changeRole(memberId: string, role: string) {
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      setError(await getErrorMessage(res));
      return;
    }
    await refresh();
  }

  async function remove(memberId: string) {
    const res = await fetch(`/api/admin/members/${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await getErrorMessage(res));
      return;
    }
    await refresh();
  }

  async function invite(formEl: HTMLFormElement) {
    const form = new FormData(formEl);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), role: form.get("role") }),
    });
    if (!res.ok) {
      setError(await getErrorMessage(res));
      return;
    }
    formEl.reset();
    await refresh();
  }

  async function cancelInvitation(invitationId: string) {
    const res = await fetch(`/api/admin/invitations/${invitationId}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await getErrorMessage(res));
      return;
    }
    await refresh();
  }

  if (error) {
    return <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>;
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("members")}</h2>
        <ul className="mt-2 space-y-2 text-sm text-foreground">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-2">
              <span>{member.user.email}</span>
              <select
                value={member.role}
                onChange={(event) => void changeRole(member.id, event.target.value)}
                aria-label={t("role")}
                className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void remove(member.id)}
                className="text-sm text-danger hover:underline"
              >
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("invitations")}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void invite(event.currentTarget);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            name="email"
            type="email"
            required
            placeholder={t("emailPlaceholder")}
            aria-label={t("emailPlaceholder")}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          />
          <select
            name="role"
            defaultValue="operator"
            aria-label={t("role")}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          >
            {roles.map((role) => (
              <option key={role} value={role}>{roleLabel(role)}</option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            {t("invite")}
          </button>
        </form>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          {invitations.length === 0 ? (
            <li className="text-muted-foreground">{t("noInvitations")}</li>
          ) : invitations.map((invitation) => (
            <li key={invitation.id} className="flex items-center justify-between gap-2">
              <span>{invitation.email} — {roleLabel(invitation.role)} ({invitation.status})</span>
              <button
                type="button"
                onClick={() => void cancelInvitation(invitation.id)}
                className="text-sm text-danger hover:underline"
              >
                {t("cancel")}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
