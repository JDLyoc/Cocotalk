
"use client";

import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { handleChat } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from "@/components/app-header";
import { auth, db } from "@/lib/firebase";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";

// Interface for messages passed to components (with ReactNode)
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: React.ReactNode;
  text_content?: string;
}

// Interface for messages stored in Firestore (plain data)
export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  file?: {
      name: string;
      type: string;
  };
}

// Interface for conversations passed to components
export interface DisplayConversation {
  id: string;
  title: string;
  messages: DisplayMessage[];
}

// Interface for conversations stored in Firestore
export interface StoredConversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: Timestamp;
  userId: string;
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
  
  const [conversations, setConversations] = React.useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [isDataLoading, setIsDataLoading] = React.useState(true);

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
    if (!isAuthReady || !auth.currentUser) {
        setIsDataLoading(false);
        return;
    }

    const q = query(
        collection(db, "users", auth.currentUser.uid, "conversations"),
        orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const conversationsData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as StoredConversation));
        setConversations(conversationsData);
        
        if (isDataLoading) {
            if (conversationsData.length > 0 && !activeConversationId) {
                setActiveConversationId(conversationsData[0].id);
            }
            setIsDataLoading(false);
        }
    }, (error) => {
        console.error("Error fetching conversations:", error);
        toast({
            variant: "destructive",
            title: "Erreur de chargement",
            description: "Impossible de charger les conversations.",
        });
        setIsDataLoading(false);
    });

    return () => unsubscribe();
}, [isAuthReady, isDataLoading, activeConversationId, toast]);


const handleSendMessage = async (text: string, file: File | null) => {
  if (!auth.currentUser) {
      toast({ variant: "destructive", title: "Erreur", description: "Utilisateur non authentifié." });
      return;
  }
  setIsLoading(true);

  let currentChatId = activeConversationId;
  const userId = auth.currentUser.uid;

  try {
      // Create new chat if none is active
      if (!currentChatId) {
          const newTitle = text
              ? text.split(' ').slice(0, 3).join(' ') + (text.split(' ').length > 3 ? '...' : '')
              : file?.name || "Nouvelle conversation";
          
          const newConvRef = await addDoc(collection(db, "users", userId, "conversations"), {
              title: newTitle,
              messages: [],
              createdAt: serverTimestamp(),
              userId: userId,
          });
          currentChatId = newConvRef.id;
          setActiveConversationId(newConvRef.id);
      }

      const convRef = doc(db, "users", userId, "conversations", currentChatId!);
      const currentMessages = conversations.find(c => c.id === currentChatId)?.messages || [];

      // Add user message
      const userMessage: StoredMessage = {
          id: Date.now().toString(),
          role: "user",
          content: text,
          ...(file && { file: { name: file.name, type: file.type } }),
      };
      const messagesWithUser = [...currentMessages, userMessage];
      await updateDoc(convRef, { messages: messagesWithUser });

      // Call AI for response
      const apiHistory = messagesWithUser.map(m => ({...m, content: <p>{m.content}</p>, text_content: m.content})) as any;
      const response = await handleChat(apiHistory, text, file);

      if (response.error) {
          throw new Error(response.error);
      }

      // Add assistant response
      const assistantMessage: StoredMessage = {
          id: Date.now().toString() + 'a',
          role: 'assistant',
          content: response.response,
      };
      await updateDoc(convRef, { messages: [...messagesWithUser, assistantMessage] });

  } catch (e: any) {
      const errorMsg = e.message || "Une erreur est survenue. Veuillez réessayer.";
      toast({
          variant: "destructive",
          title: "Erreur",
          description: errorMsg,
      });
  } finally {
      setIsLoading(false);
  }
};


  const createNewChat = async () => {
    if (!auth.currentUser) return;
    try {
        const docRef = await addDoc(collection(db, "users", auth.currentUser.uid, "conversations"), {
            title: `Nouvelle Conversation`,
            messages: [],
            createdAt: serverTimestamp(),
            userId: auth.currentUser.uid,
        });
        setActiveConversationId(docRef.id);
    } catch (error) {
        console.error("Error creating new chat:", error);
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de créer une nouvelle conversation.' });
    }
  }
  
  const handleRenameConversation = async (id: string, title: string) => {
    if (!auth.currentUser) return;
    const convRef = doc(db, "users", auth.currentUser.uid, "conversations", id);
    try {
        await updateDoc(convRef, { title });
    } catch (error) {
        console.error("Error renaming conversation:", error);
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de renommer la conversation.' });
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!auth.currentUser) return;
    
    if (activeConversationId === id) {
        const currentIndex = conversations.findIndex(c => c.id === id);
        if (conversations.length > 1) {
            const newActiveIndex = currentIndex > 0 ? currentIndex - 1 : 1;
            if (conversations[newActiveIndex]) {
              setActiveConversationId(conversations[newActiveIndex].id);
            } else {
              setActiveConversationId(null);
            }
        } else {
            setActiveConversationId(null);
        }
    }
    
    const convRef = doc(db, "users", auth.currentUser.uid, "conversations", id);
    try {
        await deleteDoc(convRef);
    } catch (error) {
        console.error("Error deleting conversation:", error);
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer la conversation.' });
    }
  };

  if (!isAuthReady || isDataLoading) {
    return <AppSkeleton />;
  }

  // --- Mapping functions to convert stored data to display data ---
  const toDisplayMessages = (messages: StoredMessage[]): DisplayMessage[] => {
    return messages.map(msg => {
      let contentNode: React.ReactNode;
      if (msg.role === 'user') {
          contentNode = (
              <>
                  {msg.content && <p className="!my-0">{msg.content}</p>}
                  {msg.file && (
                      <div className="mt-2 p-2 border rounded-lg bg-muted text-muted-foreground text-sm">
                          Fichier joint: {msg.file.name}
                      </div>
                  )}
              </>
          );
      } else {
          contentNode = <p className="!my-0">{msg.content}</p>;
      }
      return {
        id: msg.id,
        role: msg.role,
        content: contentNode,
        text_content: msg.content,
      };
    });
  };

  const displayConversations: DisplayConversation[] = conversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    messages: [], // We only need messages for the active conversation
  }));

  const activeDisplayConversation = activeConversation ? {
    id: activeConversation.id,
    title: activeConversation.title,
    messages: toDisplayMessages(activeConversation.messages),
  } : null;

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          conversations={displayConversations}
          activeConversationId={activeConversationId}
          setActiveConversationId={setActiveConversationId}
          createNewChat={createNewChat}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
        />
        <main className="flex flex-1 flex-col">
          {activeDisplayConversation ? (
            <ChatPanel
              key={activeConversationId}
              messages={activeDisplayConversation.messages}
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

    