"use client";

import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { handleChat } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";

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
  const [logo, setLogo] = useLocalStorage<string | null>("app-logo", null);
  const { toast } = useToast();

  const [conversations, setConversations] = React.useState<Conversation[]>([
    {
      id: "1",
      title: "Conversation de bienvenue",
      messages: [
        {
          id: "1",
          role: "assistant",
          content: "Bonjour! Je suis votre assistant. Comment puis-je vous aider aujourd'hui?",
          text_content: "Bonjour! Je suis votre assistant. Comment puis-je vous aider aujourd'hui?"
        },
      ],
    },
  ]);
  const [activeConversationId, setActiveConversationId] = React.useState<string>("1");
  const [isLoading, setIsLoading] = React.useState(false);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const addMessage = (message: Message) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === activeConversationId
          ? { ...conv, messages: [...conv.messages, message] }
          : conv
      )
    );
  };

  const handleSendMessage = async (text: string, file: File | null) => {
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
    
    addMessage({ id: Date.now().toString(), role: 'user', content: userMessageContent, text_content: text });

    try {
      const response = await handleChat(activeConversation?.messages ?? [], text, file);

      if (response.error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: response.error,
        });
        addMessage({
          id: Date.now().toString() + 'err',
          role: 'system',
          content: <p className="text-destructive">{response.error}</p>,
          text_content: response.error,
        });
      } else {
         addMessage({
            id: Date.now().toString(),
            role: "assistant",
            content: response.response,
            text_content: response.response,
        });
      }
    } catch (e) {
      const errorMsg = "Une erreur est survenue. Veuillez réessayer.";
      toast({
        variant: "destructive",
        title: "Erreur",
        description: errorMsg,
      });
      addMessage({
          id: Date.now().toString() + 'err',
          role: 'system',
          content: <p className="text-destructive">{errorMsg}</p>,
          text_content: errorMsg
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = () => {
    const newId = (conversations.length + 1).toString();
    const newConversation: Conversation = {
      id: newId,
      title: `Nouvelle conversation ${newId}`,
      messages: [
        {
          id: "1",
          role: "assistant",
          content: "Bonjour! Prêt à discuter?",
          text_content: "Bonjour! Prêt à discuter?"
        }
      ]
    };
    setConversations(prev => [...prev, newConversation]);
    setActiveConversationId(newId);
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <AppSidebar
        logo={logo}
        setLogo={setLogo}
        conversations={conversations}
        activeConversationId={activeConversationId}
        setActiveConversationId={setActiveConversationId}
        createNewChat={createNewChat}
      />
      <main className="flex flex-1 flex-col">
        {activeConversation ? (
          <ChatPanel
            messages={activeConversation.messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            title={activeConversation.title}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>Sélectionnez une conversation pour commencer</p>
          </div>
        )}
      </main>
    </div>
  );
}
