"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type DocumentRow = {
  id: string;
  title: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

type ContactRow = { id: string; name: string; company: string | null };
type HistoryRow = { id: string; event: string; entity: string; createdAt: string };

export default function BrainPage() {
  const t = useTranslations("brain");
  const [documentsList, setDocumentsList] = useState<DocumentRow[]>([]);
  const [contactsList, setContactsList] = useState<ContactRow[]>([]);
  const [historyList, setHistoryList] = useState<HistoryRow[]>([]);
  const [query, setQuery] = useState("");

  async function loadDocuments(q: string) {
    const res = await fetch(q ? `/api/documents?q=${encodeURIComponent(q)}` : "/api/documents");
    if (!res.ok) return;
    setDocumentsList(await res.json());
  }

  useEffect(() => {
    void loadDocuments("");
    fetch("/api/brain/contacts").then((res) => res.json()).then(setContactsList);
    fetch("/api/brain/history").then((res) => res.json()).then(setHistoryList);
  }, []);

  async function upload(formEl: HTMLFormElement) {
    const res = await fetch("/api/documents", { method: "POST", body: new FormData(formEl) });
    if (!res.ok) return;
    formEl.reset();
    await loadDocuments(query);
  }

  const needle = query.toLowerCase();
  const filteredContacts = needle
    ? contactsList.filter((contact) => contact.name.toLowerCase().includes(needle))
    : contactsList;
  const filteredHistory = needle
    ? historyList.filter((history) => history.event.toLowerCase().includes(needle))
    : historyList;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card xl:col-span-2">
        <h1 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("documents")}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void upload(event.currentTarget);
          }}
          className="flex gap-2"
        >
          <input
            name="title"
            placeholder={t("titlePlaceholder")}
            aria-label={t("titlePlaceholder")}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          />
          <input name="file" type="file" aria-label={t("fileLabel")} className="text-sm" />
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            {t("upload")}
          </button>
        </form>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            void loadDocuments(event.target.value);
          }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm"
        />
        <ul className="space-y-1 text-sm text-foreground">
          {documentsList.map((document) => (
            <li key={document.id}>
              <a href={`/api/documents/${document.id}/content`} className="text-primary hover:underline">
                {document.title}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("contacts")}</h2>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {filteredContacts.map((contact) => <li key={contact.id}>{contact.name}</li>)}
          </ul>
        </section>
        <section className="rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("history")}</h2>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {filteredHistory.map((history) => <li key={history.id}>{history.event}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
