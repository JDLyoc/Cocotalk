"use client";

import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";
import type { Message } from "@/app/page";

export function ChatMessage({ role, content }: Omit<Message, 'id'>) {
  const isUser = role === "user";

  return (
    <div className={cn("flex items-start gap-4", isUser && "justify-end")}>
      {!isUser && (
        <Avatar className="h-9 w-9 border">
          <AvatarFallback className="bg-primary/20 text-primary">
            <Bot className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-md rounded-lg p-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border"
        )}
      >
        <div className="prose prose-sm max-w-none text-current break-words">{content}</div>
      </div>
      {isUser && (
        <Avatar className="h-9 w-9 border">
          <AvatarFallback>
            <User className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
