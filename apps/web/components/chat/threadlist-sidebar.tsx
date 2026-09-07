"use client";

import { useTranslations } from "next-intl";
import { MessagesSquare } from "lucide-react";
import { ThreadList } from "./thread-list";

export function ThreadListSidebar() {
  const t = useTranslations("chat");
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MessagesSquare className="size-4" />
        </div>
        <span className="font-semibold">{t("threadListHeading")}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <ThreadList />
      </div>
    </aside>
  );
}
