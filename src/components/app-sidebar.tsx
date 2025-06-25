"use client";

import { LogOut, MessageSquare, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { Conversation } from "@/app/page";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  createNewChat: () => void;
}

export function AppSidebar({
  conversations,
  activeConversationId,
  setActiveConversationId,
  createNewChat,
}: AppSidebarProps) {
  return (
    <aside className="flex h-full w-full max-w-[280px] flex-col bg-sidebar text-sidebar-foreground p-4">
      <div className="space-y-2 mb-4">
        <Button size="lg" className="w-full justify-center font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg" onClick={createNewChat}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau Chat
        </Button>
      </div>

      <h3 className="px-2 pt-4 pb-2 text-xs font-semibold uppercase text-muted-foreground/80 tracking-wider">
        Conversations Récentes
      </h3>

      <ScrollArea className="flex-1 -mx-4">
        <div className="px-4 space-y-1">
          {conversations.map((conv) => (
            <Button
              key={conv.id}
              variant={conv.id === activeConversationId ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start font-normal",
                conv.id === activeConversationId ? "bg-black/20 text-white" : "hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={() => setActiveConversationId(conv.id)}
            >
              <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{conv.title}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>
      <div className="mt-auto border-t border-sidebar-foreground/10 -mx-4 pt-4 px-4">
        <Button variant="ghost" className="w-full justify-start hover:bg-accent hover:text-accent-foreground" onClick={() => alert("Fonction de déconnexion à implémenter")}>
            <LogOut className="mr-3 h-5 w-5" />
            <span className="font-medium">Se déconnecter</span>
        </Button>
      </div>
    </aside>
  );
}
