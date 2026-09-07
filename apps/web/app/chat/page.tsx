"use client";

import { useTranslations } from "next-intl";
import { ChatRuntimeProvider } from "@/components/chat/runtime-provider";
import { ThreadListSidebar } from "@/components/chat/threadlist-sidebar";
import { Thread } from "@/components/chat/thread";
import { ContextRail } from "@/components/chat/context-rail";

export default function ChatPage() {
  const t = useTranslations("chat");
  return (
    <ChatRuntimeProvider>
      <div className="flex h-full">
        <ThreadListSidebar />
        <section
          role="region"
          aria-label={t("conversation")}
          className="min-w-0 flex-1"
        >
          <Thread />
        </section>
        <ContextRail />
      </div>
    </ChatRuntimeProvider>
  );
}
