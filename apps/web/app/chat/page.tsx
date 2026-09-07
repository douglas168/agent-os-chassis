"use client";

import { useTranslations } from "next-intl";
import { ChatRuntimeProvider } from "@/components/chat/runtime-provider";
import { ThreadListSidebar } from "@/components/chat/threadlist-sidebar";
import { Thread } from "@/components/chat/thread";
import { ContextRail } from "@/components/chat/context-rail";
import { RunToolUI } from "@/components/chat/run-tool-ui";
import { DecideToolUI } from "@/components/chat/decide-tool-ui";

export default function ChatPage() {
  const t = useTranslations("chat");
  return (
    <ChatRuntimeProvider>
      <RunToolUI />
      <DecideToolUI />
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
