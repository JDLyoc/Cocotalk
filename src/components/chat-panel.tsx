"use client";

import * as React from "react";
import { Paperclip, Send, Loader2, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { ChatMessage } from "./chat-message";
import type { DisplayMessage } from "@/app/page";
import { useToast } from "@/hooks/use-toast";


interface ChatPanelProps {
  messages: DisplayMessage[];
  onSendMessage: (text: string, file: File | null) => void;
  isLoading: boolean;
  isWelcomeMode?: boolean;
}

function WelcomeScreen() {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-center p-4">
        <div className="p-4 rounded-full mb-4">
          <MessageSquare className="h-16 w-16 text-accent" />
        </div>
        <h2 className="text-3xl font-semibold">Commencez une conversation</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Posez-moi n'importe quelle question ! Je suis là pour vous aider avec des informations, résoudre des problèmes ou simplement discuter.
        </p>
      </div>
    );
  }

export function ChatPanel({ messages, onSendMessage, isLoading, isWelcomeMode = false }: ChatPanelProps) {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleSend = () => {
    if (isLoading) return;
    if (!text.trim() && !file) return;
    onSendMessage(text, file);
    setText("");
    setFile(null);
    if(fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain'];
        if(supportedTypes.includes(selectedFile.type)) {
            setFile(selectedFile);
        } else {
            toast({
                variant: 'destructive',
                title: 'Fichier non supporté',
                description: 'Veuillez sélectionner une image (jpeg, png, etc.) ou un fichier texte (.txt).'
            });
        }
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleAttachClick = () => {
    toast({ title: 'Ajouter des fichiers' });
    fileInputRef.current?.click();
  };

  return (
    <div className="flex h-full flex-col relative">
      <div className="flex-1 relative">
        <ScrollArea className="absolute inset-0 p-4" ref={scrollAreaRef}>
          {isWelcomeMode && messages.length === 0 && <WelcomeScreen />}
          <div className="space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
            ))}
            {isLoading && (
               <ChatMessage id="loading" role="assistant" content={<div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>L'assistant réfléchit...</span></div>} />
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t p-4 bg-background">
        <div className="relative rounded-lg border bg-card">
          <Textarea
            placeholder="Tapez votre message..."
            className="pr-20 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,text/plain,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleAttachClick}
            >
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Joindre un fichier</span>
            </Button>
            <Button type="submit" size="icon" onClick={handleSend} disabled={isLoading || (!text && !file)} className="bg-[#3C63A6] hover:bg-[#3C63A6]/90 disabled:bg-[#3C63A6] disabled:opacity-70">
              <Send className="h-5 w-5" />
              <span className="sr-only">Envoyer</span>
            </Button>
          </div>
        </div>
        {file && <p className="text-sm text-muted-foreground mt-2">Fichier joint : {file.name} <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setFile(null)}> (Retirer)</Button></p>}
      </div>
    </div>
  );
}
