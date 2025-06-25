
"use client";

import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { handleChat } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from "@/components/app-header";

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

export default function Home() {
  const { toast } = useToast();
  
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  
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
    if (!currentChatId) {
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
    
    // Add message to the correct conversation
    setConversations(prev =>
        prev.map(conv =>
          conv.id === currentChatId
            ? { ...conv, messages: [...conv.messages, { id: Date.now().toString(), role: 'user', content: userMessageContent, text_content: text }] }
            : conv
        )
      );

    try {
      const response = await handleChat(activeConversation?.messages ?? [], text, file);

      if (response.error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: response.error,
        });
        setConversations(prev =>
            prev.map(conv =>
              conv.id === currentChatId
                ? { ...conv, messages: [...conv.messages, { id: Date.now().toString() + 'err', role: 'system', content: <p className="text-destructive">{response.error}</p>, text_content: response.error}] }
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
            ? { ...conv, messages: [...conv.messages, { id: Date.now().toString() + 'err', role: 'system', content: <p className="text-destructive">{errorMsg}</p>, text_content: errorMsg}] }
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
