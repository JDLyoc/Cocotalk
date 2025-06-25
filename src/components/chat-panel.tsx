"use client";

import * as React from "react";
import { Paperclip, Send, Loader2, LayoutDashboard, User } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { ChatMessage } from "./chat-message";
import type { Message } from "@/app/page";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Dashboard } from "./dashboard";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (text: string, file: File | null) => void;
  isLoading: boolean;
}

export function ChatPanel({ messages, onSendMessage, isLoading }: ChatPanelProps) {
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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border">
            <AvatarFallback>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium text-foreground">utilisateur@exemple.com</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <LayoutDashboard className="h-5 w-5" />
              <span className="sr-only">Ouvrir le tableau de bord</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl h-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Tableau de bord</DialogTitle>
            </DialogHeader>
            <Dashboard />
          </DialogContent>
        </Dialog>
      </header>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} {...msg} />
          ))}
          {isLoading && (
             <ChatMessage id="loading" role="assistant" content={<div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>L'assistant réfléchit...</span></div>} />
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <div className="relative rounded-lg border bg-card">
          <Textarea
            placeholder="Écrivez votre message ici..."
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
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Joindre un fichier</span>
            </Button>
            <Button type="submit" size="icon" onClick={handleSend} disabled={isLoading || (!text && !file)}>
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
