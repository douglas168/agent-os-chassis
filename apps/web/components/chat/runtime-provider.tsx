"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
  AssistantRuntimeProvider,
} from "@assistant-ui/react";
import type { ReadonlyJSONObject } from "assistant-stream/utils";

type ChatToolCall = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ChatToolCall[];
};

const convertMessage = (message: ChatMessage): ThreadMessageLike => ({
  role: message.role,
  content: [
    ...(message.toolCalls ?? []).map((call) => ({
      type: "tool-call" as const,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      args: call.args as ReadonlyJSONObject,
      result: call.result,
      isError: call.isError,
    })),
    ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
  ],
});

async function backendApi(_history: ChatMessage[]): Promise<ChatMessage> {
  return { role: "assistant", content: "" };
}

export function ChatRuntimeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const t = useTranslations("chat");
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== "text") {
      throw new Error("Only text messages are supported");
    }
    const input = message.content[0].text;
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: input },
    ];
    setMessages(nextMessages);
    setIsRunning(true);
    try {
      const assistant = await backendApi(nextMessages);
      setMessages((prev) => [...prev, assistant]);
    } finally {
      setIsRunning(false);
    }
  };

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
    adapters: {
      threadList: {
        threadId: "default",
        threads: [
          {
            id: "default",
            status: "regular" as const,
            title: t("defaultThreadTitle"),
          },
        ],
        archivedThreads: [],
        onSwitchToNewThread: async () => {},
        onSwitchToThread: async () => {},
        onRename: async () => {},
        onArchive: async () => {},
        onUnarchive: async () => {},
        onDelete: async () => {},
      },
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
