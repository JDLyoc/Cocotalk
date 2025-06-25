
"use client";

import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { handleChat } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from "@/components/app-header";
import { auth } from "@/lib/firebase";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: React.ReactNode;
  text_content?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

function AppSkeleton() {
    return (
        <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
            <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 z-10">
                <div className="flex items-center gap-6">
                    <Skeleton className="h-12 w-[140px]" />
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-9 w-36" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>
            <div className="flex flex-1 overflow-hidden">
                <aside className="flex h-full w-full max-w-[280px] flex-col bg-sidebar text-sidebar-foreground p-4">
                    <Skeleton className="h-11 w-full mb-4" />
                    <Skeleton className="h-6 w-3/4 mb-4" />
                    <div className="space-y-1">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </aside>
                <main className="flex flex-1 flex-col">
                    <div className="flex h-full flex-col items-center justify-center bg-background text-center p-4">
                       <Skeleton className="h-16 w-16 rounded-full mb-4" />
                       <Skeleton className="h-8 w-64 mb-2" />
                       <Skeleton className="h-5 w-80" />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function Home() {
  const { toast } = useToast();
  
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAuthReady, setIsAuthReady] = React.useState(false);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        setIsAuthReady(true);
      } else {
        signInAnonymously(auth).catch(error => {
          console.error("Anonymous sign-in failed:", error);
          toast({
            variant: "destructive",
            title: "Erreur d'authentification",
            description: "Impossible de se connecter au backend. Veuillez actualiser la page.",
          });
        });
      }
    });
    return () => unsubscribe();
  }, [toast]);

  React.useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
    if (conversations.length === 0) {
      setActiveConversationId(null);
    }
  }, [conversations, activeConversationId]);

  const addMessage = (message: Message) => {
    if (!activeConversationId) return;
    setConversations(prev =>
      prev.map(conv =>
        conv.id === activeConversationId
          ? { ...conv, messages: [...conv.messages, message] }
          : conv
      )
    );
  };

  const handleSendMessage = async (text: string, file: File | null) => {
    let currentChatId = activeConversationId;
    let isNewChat = !currentChatId;
  
    if (isNewChat) {
      const newId = createNewChat(true);
      currentChatId = newId;
    }
  
    if (!text && !file) return;
  
    setIsLoading(true);
  
    const userMessageContent = (
      <div className="flex flex-col gap-2">
        <p>{text}</p>
        {file && (
          <div className="mt-2 p-2 border rounded-lg bg-muted/50 text-sm">
            Fichier joint: {file.name}
          </div>
        )}
      </div>
    );
  
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessageContent,
      text_content: text,
    };
  
    const conversationBeforeUpdate = conversations.find(c => c.id === currentChatId);
    const isFirstMessage = isNewChat || (conversationBeforeUpdate?.messages.length === 0);
  
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === currentChatId) {
          const newTitle = isFirstMessage && text
            ? text.split(' ').slice(0, 3).join(' ') + (text.split(' ').length > 3 ? '...' : '')
            : conv.title;
          
          return {
            ...conv,
            title: newTitle,
            messages: [...conv.messages, userMessage],
          };
        }
        return conv;
      })
    );
    
    const historyForApi = [...(conversationBeforeUpdate?.messages ?? []), userMessage];
  
    try {
      const response = await handleChat(historyForApi, text, file);
  
      if (response.error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: response.error,
        });
        setConversations(prev =>
          prev.map(conv =>
            conv.id === currentChatId
              ? { ...conv, messages: [...conv.messages, { id: Date.now().toString() + 'err', role: 'system', content: <p className="text-destructive">{response.error}</p>, text_content: response.error }] }
              : conv
          )
        );
      } else {
        setConversations(prev =>
          prev.map(conv =>
            conv.id === currentChatId
              ? { ...conv, messages: [...conv.messages, { id: Date.now().toString(), role: "assistant", content: response.response, text_content: response.response }] }
              : conv
          )
        );
      }
    } catch (e) {
      const errorMsg = "Une erreur est survenue. Veuillez réessayer.";
      toast({
        variant: "destructive",
        title: "Erreur",
        description: errorMsg,
      });
      setConversations(prev =>
        prev.map(conv =>
          conv.id === currentChatId
            ? { ...conv, messages: [...conv.messages, { id: Date.now().toString() + 'err', role: 'system', content: <p className="text-destructive">{errorMsg}</p>, text_content: errorMsg }] }
            : conv
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = (silent = false) => {
    const newId = Date.now().toString();
    const newConversation: Conversation = {
      id: newId,
      title: `Conversation #${conversations.length + 1}`,
      messages: []
    };
    setConversations(prev => [newConversation, ...prev]);
    if (!silent) {
        setActiveConversationId(newId);
    }
    return newId;
  }
  
  if (!isAuthReady) {
    return <AppSkeleton />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          setActiveConversationId={setActiveConversationId}
          createNewChat={() => createNewChat()}
        />
        <main className="flex flex-1 flex-col">
          {activeConversation ? (
            <ChatPanel
              key={activeConversationId}
              messages={activeConversation.messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          ) : (
            <ChatPanel
              key="welcome"
              messages={[]}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isWelcomeMode={true}
            />
          )}
        </main>
      </div>
    </div>
  );
}
