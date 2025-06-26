
"use client";

import * as React from "react";
import { Paperclip, Send, Loader2, MessageSquare, FileUp, ScanSearch, Sparkles, ArrowDown } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { ChatMessage } from "./chat-message";
import type { DisplayMessage, StoredCocotalk } from "@/app/page";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface ChatPanelProps {
  messages: DisplayMessage[];
  onSendMessage: (text: string, file: File | null) => void;
  isLoading: boolean;
  isWelcomeMode?: boolean;
  activeCocotalk?: StoredCocotalk | null;
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

function CocotalkWelcomeScreen({ cocotalk, onStarterClick }: { cocotalk: StoredCocotalk; onStarterClick: (text: string) => void; }) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-center p-4">
        <div className="p-4 rounded-full mb-4">
          <Sparkles className="h-16 w-16 text-accent" />
        </div>
        <h2 className="text-3xl font-semibold">{cocotalk.title}</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          {cocotalk.description}
        </p>
        {cocotalk.starterMessage && (
            <Button variant="outline" className="mt-6" onClick={() => onStarterClick(cocotalk.starterMessage)}>
                {cocotalk.starterMessage}
            </Button>
        )}
      </div>
    );
}

export function ChatPanel({ messages, onSendMessage, isLoading, isWelcomeMode = false, activeCocotalk = null }: ChatPanelProps) {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const docFileInputRef = React.useRef<HTMLInputElement>(null);
  const imageFileInputRef = React.useRef<HTMLInputElement>(null);

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  
  const { toast } = useToast();

  const scrollToBottom = React.useCallback(() => {
    if (viewportRef.current) {
        viewportRef.current.scrollTo({
            top: viewportRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  }, []);

  React.useEffect(() => {
    const scrollAreaElement = scrollAreaRef.current;
    if (scrollAreaElement) {
        const viewportElement = scrollAreaElement.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
        if (viewportElement) {
            viewportRef.current = viewportElement;

            const handleScroll = () => {
                if (viewportRef.current) {
                    const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
                    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
                    setIsAtBottom(atBottom);
                }
            };

            viewportElement.addEventListener('scroll', handleScroll, { passive: true });
            handleScroll(); // Initial check

            return () => {
                viewportElement.removeEventListener('scroll', handleScroll);
            };
        }
    }
  }, []);

  React.useEffect(() => {
    // When new messages arrive, scroll to bottom automatically.
    // Use a small timeout to allow the DOM to update.
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  const handleSend = () => {
    if (isLoading) return;
    if (!text.trim() && !file) return;
    onSendMessage(text, file);
    setText("");
    setFile(null);
    if(docFileInputRef.current) {
      docFileInputRef.current.value = "";
    }
    if(imageFileInputRef.current) {
        imageFileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleStarterClick = (starter: string) => {
    setText(starter);
  };

  const docTypes = "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";
  const imageTypes = "image/jpeg,image/png,image/webp,image/gif";

  const showWelcome = isWelcomeMode && messages.length === 0;
  const showCocotalkWelcome = activeCocotalk && messages.length <= 1 && !messages.some(m => m.role === 'user');

  return (
    <div className="flex h-full flex-col relative">
      <div className="flex-1 relative">
        <ScrollArea className="absolute inset-0 p-4" ref={scrollAreaRef}>
          {showWelcome && <WelcomeScreen />}
          {showCocotalkWelcome && <CocotalkWelcomeScreen cocotalk={activeCocotalk} onStarterClick={handleStarterClick} />}
          
          <div className="space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
            ))}
            {isLoading && messages.length > 0 && (
               <ChatMessage id="loading" role="assistant" content={<div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>L'assistant réfléchit...</span></div>} />
            )}
          </div>
        </ScrollArea>
        {!isAtBottom && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <Button
                    size="icon"
                    className="rounded-full shadow-lg bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={scrollToBottom}
                >
                    <ArrowDown className="h-5 w-5" />
                    <span className="sr-only">Faire défiler vers le bas</span>
                </Button>
            </div>
        )}
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
            <input type="file" ref={docFileInputRef} onChange={handleFileChange} className="hidden" accept={docTypes} />
            <input type="file" ref={imageFileInputRef} onChange={handleFileChange} className="hidden" accept={imageTypes} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => toast({ description: "Choisissez une option" })}
                >
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Joindre un fichier</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end">
                <DropdownMenuItem onClick={() => docFileInputRef.current?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />
                  <span>Ajouter des fichiers</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => imageFileInputRef.current?.click()}>
                  <ScanSearch className="mr-2 h-4 w-4" />
                  <span>Analyser une image</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="submit" size="icon" onClick={handleSend} disabled={isLoading || (!text && !file)} className="bg-[#2A4D8F] hover:bg-[#3C63A6] disabled:bg-[#2A4D8F] disabled:opacity-70">
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
