"use client";

import { Bot, User, Copy, Check } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { cn } from "@/lib/utils";
import type { DisplayMessage } from "@/lib/types";
import { Button } from "./ui/button";
import * as React from "react";
import { useToast } from "@/hooks/use-toast";

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


export function ChatMessage({ role, content, text_content }: Omit<DisplayMessage, 'id'>) {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = () => {
    if (!text_content) return;
    navigator.clipboard.writeText(text_content).then(() => {
      setIsCopied(true);
      toast({ title: "Copié!", description: "Le message a été copié dans le presse-papiers." });
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de copier le message.',
      });
    });
  };

  const isUser = role === "user";
  const canCopy = !!text_content && text_content.trim().length > 0;

  const CopyButton = () => (
      canCopy ? (
          <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 self-center opacity-0 transition-opacity group-hover:opacity-100"
              onClick={handleCopy}
          >
              {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              <span className="sr-only">Copier le message</span>
          </Button>
      ) : null
  );

  return (
    <div className={cn("group flex items-start gap-3", isUser && "justify-end")}>
      {!isUser && (
        <Avatar className="h-9 w-9 border">
          <AvatarFallback className="bg-accent text-white" style={{backgroundColor: '#fcd306'}}>
            <Bot className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      )}

      {isUser && <CopyButton />}

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

      {!isUser && <CopyButton />}

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
