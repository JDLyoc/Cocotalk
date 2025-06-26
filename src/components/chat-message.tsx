
"use client";

import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";
import type { DisplayMessage } from "@/app/page";

// This would ideally come from user context or props in a full implementation
const userEmail = "contentredac@gmail.com"; 

const getInitials = (email: string) => {
    if (!email) return "U";
    const namePart = email.split('@')[0];
    return namePart.substring(0, 2).toUpperCase();
};


export function ChatMessage({ role, content }: Omit<DisplayMessage, 'id' | 'text_content'>) {
  const isUser = role === "user";

  return (
    <div className={cn("flex items-start gap-4", isUser && "justify-end")}>
      {!isUser && (
        <Avatar className="h-9 w-9 border">
          <AvatarFallback className="bg-accent text-white" style={{backgroundColor: '#fcd306'}}>
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
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(userEmail)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
