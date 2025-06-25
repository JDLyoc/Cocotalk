"use client";

import Image from "next/image";
import { MessageSquare, Plus, Bot } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { Conversation } from "@/app/page";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  createNewChat: () => void;
  logo: string | null;
}

export function AppSidebar({
  conversations,
  activeConversationId,
  setActiveConversationId,
  createNewChat,
  logo,
}: AppSidebarProps) {
  return (
    <aside className="flex h-full w-full max-w-xs flex-col bg-card text-card-foreground p-4 border-r">
      <div className="flex items-center justify-center pt-2 pb-4 mb-2">
        <div className="p-1 rounded-lg">
          {logo ? (
            <Image
              src={logo}
              alt="Custom user logo"
              width={80}
              height={80}
              className="object-contain"
            />
          ) : (
            <Bot className="h-20 w-20 text-primary" />
          )}
        </div>
      </div>

      <Button variant="outline" className="mb-4 w-full justify-start" onClick={createNewChat}>
        <Plus className="mr-2 h-4 w-4" />
        Nouvelle Conversation
      </Button>

      <ScrollArea className="flex-1 -mx-4">
        <div className="px-4 space-y-2">
          {conversations.map((conv) => (
            <Button
              key={conv.id}
              variant={conv.id === activeConversationId ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                conv.id === activeConversationId && "bg-primary/10 text-primary"
              )}
              onClick={() => setActiveConversationId(conv.id)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              <span className="truncate">{conv.title}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
