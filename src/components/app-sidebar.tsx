"use client";

import { MessageSquare, Plus, Bot, Upload } from "lucide-react";
import Image from "next/image";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { Conversation } from "@/app/page";
import { cn } from "@/lib/utils";
import { LogoUploader } from "./logo-uploader";

interface AppSidebarProps {
  logo: string | null;
  setLogo: (logo: string | null) => void;
  conversations: Conversation[];
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  createNewChat: () => void;
}

export function AppSidebar({
  logo,
  setLogo,
  conversations,
  activeConversationId,
  setActiveConversationId,
  createNewChat,
}: AppSidebarProps) {
  return (
    <aside className="flex h-full w-full max-w-xs flex-col bg-card text-card-foreground p-4 border-r">
      <div className="flex items-center justify-center gap-3 pb-4 border-b mb-4">
        {logo ? (
          <Image
            src={logo}
            alt="App logo"
            width={144}
            height={144}
            className="rounded-md object-contain"
          />
        ) : (
          <div className="bg-accent p-6 rounded-lg">
            <Bot className="h-16 w-16 text-accent-foreground" />
          </div>
        )}
      </div>

      <Button variant="outline" className="mb-4" onClick={createNewChat}>
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

      <div className="mt-4 pt-4 border-t">
        <LogoUploader onLogoUpload={setLogo}>
          <Button variant="ghost" className="w-full justify-start">
            <Upload className="mr-2 h-4 w-4" />
            Changer le logo
          </Button>
        </LogoUploader>
      </div>
    </aside>
  );
}
