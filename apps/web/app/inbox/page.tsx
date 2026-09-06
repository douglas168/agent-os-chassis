"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Message = {
  id: string;
  channel: string;
  from: string;
  subject: string | null;
  body: string;
  contactId: string | null;
  createdAt: string;
};

export default function InboxPage() {
  const t = useTranslations("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inbox").then(async (res) => {
      if (!res.ok) {
        setError(t("error"));
        return;
      }
      setMessages(await res.json());
    });
  }, [t]);

  if (error) {
    return <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>;
  }

  const matched = messages.filter((message) => message.contactId != null);
  const unmatched = messages.filter((message) => message.contactId == null);

  function MessageRow({ message }: { message: Message }) {
    return (
      <li className="rounded-lg border border-border bg-card p-3 text-sm shadow-card">
        <span className="font-medium text-foreground">{message.from}</span> — {message.subject ?? t("noSubject")}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("matched")}</h2>
        <ul className="space-y-2">
          {matched.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("matchedEmpty")}</li>
          ) : (
            matched.map((message) => <MessageRow key={message.id} message={message} />)
          )}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("unmatched")}</h2>
        <ul className="space-y-2">
          {unmatched.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("unmatchedEmpty")}</li>
          ) : (
            unmatched.map((message) => <MessageRow key={message.id} message={message} />)
          )}
        </ul>
      </section>
    </div>
  );
}
