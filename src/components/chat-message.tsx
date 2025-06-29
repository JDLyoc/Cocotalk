"use client";

import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { cn } from "@/lib/utils";
import type { DisplayMessage } from "@/lib/types";

const user = { 
    email: "contentredac@gmail.com",
    name: null as string | null
}; 

const getInitials = (name: string | null, email: string): string => {
    if (name) {
        const parts = name.trim().split(' ').filter(Boolean);
        if (parts.length > 1) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        if (parts.length === 1 && parts[0].length > 0) {
            return parts[0].substring(0, 2).toUpperCase();
        }
    }
    
    if (email) {
        const emailPart = email.split('@')[0];
        if (emailPart) {
            return emailPart.substring(0, 2).toUpperCase();
        }
    }

    return "U";
};


export function ChatMessage({ role, content }: Omit<DisplayMessage, 'id' | 'text_content'>) {
  const isUser = role === "user";

  return (
    <div className={cn("flex items-start gap-4", isUser && "justify-end")}>
      {!isUser && ( // This now handles role === "model"
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
            ? "bg-card border"
            : "bg-card border"
        )}
      >
        <div className="prose prose-sm max-w-none text-current break-words">{content}</div>
      </div>
      {isUser && (
        <Avatar className="h-9 w-9 border">
          <AvatarFallback className="text-white" style={{backgroundColor: '#3C63A6'}}>
            {getInitials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
