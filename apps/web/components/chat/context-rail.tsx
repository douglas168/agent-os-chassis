"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type ContactRow = { id: string; name: string; company: string | null };
type DocumentRow = { id: string; title: string };

export function ContextRail() {
  const t = useTranslations("chat");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  useEffect(() => {
    fetch("/api/brain/contacts")
      .then((response) => response.json())
      .then(setContacts);
    fetch("/api/documents")
      .then((response) => response.json())
      .then(setDocuments);
  }, []);

  return (
    <aside className="w-64 shrink-0 space-y-4 border-l border-border p-3">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("contacts")}
        </h2>
        <ul className="mt-1 space-y-1 text-sm text-foreground">
          {contacts.map((contact) => (
            <li key={contact.id}>{contact.name}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("documents")}
        </h2>
        <ul className="mt-1 space-y-1 text-sm text-foreground">
          {documents.map((document) => (
            <li key={document.id}>{document.title}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
