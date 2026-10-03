"use client";

import { use } from "react";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  return <ChatWorkspace conversationId={conversationId} />;
}
