
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
  setDoc,
} from "firebase/firestore";
import type { CocotalkFormValues } from "@/components/cocotalk-form";
import type { Message } from "genkit";

// Interface for messages passed to components (with ReactNode)
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: React.ReactNode;
  text_content?: string;
}

// Interface for messages stored in Firestore
export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string; // This should always be a string
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
  cocotalkOriginId?: string;
}

// Interface for custom assistants (Cocotalks)
export interface StoredCocotalk {
  id: string;
  title: string;
  description: string;
  persona?: string;
  instructions: string; // This is now the agent's full scenario/brain
  starterMessage: string;
  greetingMessage?: string;
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
  const [cocotalks, setCocotalks] = React.useState<StoredCocotalk[]>([]);
  const [activeCocotalkId, setActiveCocotalkId] = React.useState<string | null>(null);

  const [isLoading, setIsLoading] = React.useState(false);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [isDataLoading, setIsDataLoading] = React.useState(true);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeCocotalk = cocotalks.find(c => c.id === activeCocotalkId);
  
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
        setIsAuthReady(true);
      } else {
        signInAnonymously(auth).catch(error => {
          console.error("Anonymous sign-in failed:", error);
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "Could not connect to the backend. Please refresh the page.",
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
            if (conversationsData.length > 0 && !activeConversationId && !activeCocotalkId) {
                setActiveConversationId(conversationsData[0].id);
            }
            setIsDataLoading(false);
        }
    }, (error) => {
        console.error("Error fetching conversations:", error);
        toast({
            variant: "destructive",
            title: "Loading Error",
            description: "Could not load conversations.",
        });
        setIsDataLoading(false);
    });

    return () => unsubscribe();
}, [isAuthReady, isDataLoading, activeConversationId, activeCocotalkId, toast]);

React.useEffect(() => {
    if (!isAuthReady || !auth.currentUser) return;
    
    const q = query(
      collection(db, "users", auth.currentUser.uid, "cocotalks"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const cocotalksData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as StoredCocotalk));
      setCocotalks(cocotalksData);
    }, (error) => {
      console.error("Error fetching cocotalks:", error);
      toast({
        variant: "destructive",
        title: "Loading Error",
        description: "Could not load custom Cocotalks.",
      });
    });

    return () => unsubscribe();
  }, [isAuthReady, toast]);


const handleSendMessage = async (text: string, file: File | null) => {
    if (!auth.currentUser) {
        toast({ variant: "destructive", title: "Erreur", description: "Utilisateur non authentifié." });
        return;
    }
    setIsLoading(true);

    let currentChatId = activeConversationId;
    const userId = auth.currentUser.uid;
    let convRef;

    try {
        if (!currentChatId) {
            const newTitle = activeCocotalk ? activeCocotalk.title : (text ? text.split(' ').slice(0, 3).join(' ') + (text.split(' ').length > 3 ? '...' : '') : file?.name || "New Conversation");
            const newConvData: Omit<StoredConversation, 'id' | 'createdAt'> = {
                title: newTitle,
                messages: [],
                userId: userId,
                ...(activeCocotalk && { cocotalkOriginId: activeCocotalk.id }),
            };
            const newConvRef = await addDoc(collection(db, "users", userId, "conversations"), {
                ...newConvData,
                createdAt: serverTimestamp(),
            });
            currentChatId = newConvRef.id;
            convRef = newConvRef;
            selectConversation(newConvRef.id);
        } else {
            convRef = doc(db, "users", userId, "conversations", currentChatId);
        }

        const currentStoredConversation = conversations.find(c => c.id === currentChatId);
        const validStoredMessages = (currentStoredConversation?.messages || []).filter(
            (m): m is StoredMessage => m && typeof m.role === 'string' && typeof m.content === 'string'
        );

        let baseMessages: StoredMessage[] = [...validStoredMessages];
        if (activeCocotalk && baseMessages.length === 0 && activeCocotalk.greetingMessage) {
            const greetingMessage: StoredMessage = {
                id: Date.now().toString() + 'g',
                role: 'assistant',
                content: activeCocotalk.greetingMessage,
            };
            baseMessages.push(greetingMessage);
        }

        const userMessage: StoredMessage = {
            id: Date.now().toString(),
            role: "user",
            content: text,
            ...(file && { file: { name: file.name, type: file.type } }),
        };

        await updateDoc(convRef, { messages: [...baseMessages, userMessage] });

        const messagesForGenkit = [...baseMessages, userMessage]
            .map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                content: msg.content
            }))
            .filter(msg => msg.role === 'user' || msg.role === 'model') as Message[];

        let agentContext: { persona?: string; rules?: string; };
        if (activeCocotalk) {
            agentContext = { persona: activeCocotalk.persona, rules: activeCocotalk.instructions };
        } else if (activeConversation?.cocotalkOriginId) {
            const origin = cocotalks.find(c => c.id === activeConversation.cocotalkOriginId);
            agentContext = origin 
                ? { persona: origin.persona, rules: origin.instructions }
                : { persona: "A helpful assistant.", rules: "You are a helpful assistant. The custom instructions for this conversation could not be found because the original agent was deleted. Inform the user about this and then proceed with the conversation as a general-purpose assistant." };
        } else {
            agentContext = { persona: "A friendly and helpful assistant.", rules: "Your job is to have a simple, helpful conversation. Respond clearly and concisely to the user's questions." };
        }

        const { response, error } = await handleChat(messagesForGenkit, file, agentContext);
        
        if (error) {
            throw new Error(error);
        }

        const assistantMessage: StoredMessage = {
            id: Date.now().toString() + 'a',
            role: 'assistant',
            content: typeof response === 'string' ? response : '', 
        };
        
        await updateDoc(convRef, { messages: [...baseMessages, userMessage, assistantMessage] });

    } catch (e: any) {
        const errorMsg = e.message || "An error occurred. Please try again.";
        toast({
            variant: "destructive",
            title: "Error",
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
            title: `New Conversation`,
            messages: [],
            createdAt: serverTimestamp(),
            userId: auth.currentUser.uid,
        });
        selectConversation(docRef.id);
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
              selectConversation(conversations[newActiveIndex].id);
            } else {
              selectConversation(null);
            }
        } else {
            selectConversation(null);
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
  
  const handleCreateCocotalk = async (values: CocotalkFormValues) => {
    if (!auth.currentUser) {
        toast({
            variant: 'destructive',
            title: 'Erreur d\'authentification',
            description: 'Veuillez patienter ou rafraîchir la page et réessayer.',
        });
        return;
    }
    try {
      const docRef = await addDoc(collection(db, "users", auth.currentUser.uid, "cocotalks"), {
        ...values,
        createdAt: serverTimestamp(),
        userId: auth.currentUser.uid,
      });
      toast({ title: 'Succès', description: 'Cocotalk créé avec succès.' });
      selectCocotalk(docRef.id);
    } catch (error) {
      console.error("Error creating new cocotalk:", error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de créer le Cocotalk.' });
    }
  };

  const handleUpdateCocotalk = async (id: string, values: CocotalkFormValues) => {
    if (!auth.currentUser) return;
    const cocotalkRef = doc(db, "users", auth.currentUser.uid, "cocotalks", id);
    try {
      await updateDoc(cocotalkRef, values as any);
      toast({ title: 'Succès', description: 'Cocotalk mis à jour avec succès.' });
    } catch (error) {
      console.error("Error updating cocotalk:", error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le Cocotalk.' });
    }
  };

  const handleDeleteCocotalk = async (id: string) => {
    if (!auth.currentUser) return;
    if (activeCocotalkId === id) {
      selectCocotalk(null);
    }
    const cocotalkRef = doc(db, "users", auth.currentUser.uid, "cocotalks", id);
    try {
      await deleteDoc(cocotalkRef);
      toast({ title: 'Succès', description: 'Cocotalk supprimé.' });
    } catch (error) {
      console.error("Error deleting cocotalk:", error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer le Cocotalk.' });
    }
  };

  const selectConversation = (id: string | null) => {
      setActiveCocotalkId(null);
      setActiveConversationId(id);
  }

  const selectCocotalk = (id: string | null) => {
      setActiveConversationId(null);
      setActiveCocotalkId(id);
  }

  if (!isAuthReady || isDataLoading) {
    return <AppSkeleton />;
  }

  const toDisplayMessages = (messages: StoredMessage[] | undefined): DisplayMessage[] => {
    if (!Array.isArray(messages)) {
        return [];
    }

    return messages
        .map(msg => {
            if (!msg || typeof msg !== 'object') {
                return null;
            }
            
            const { id, role, content } = msg;

            if (typeof id !== 'string' || !['user', 'assistant', 'system'].includes(role)) {
                return null;
            }

            const textContent = (typeof content === 'string') ? content : '';
            
            let contentNode: React.ReactNode;

            if (role === 'user') {
                contentNode = (
                    <>
                        <p className="!my-0">{textContent}</p>
                        {msg.file && (
                            <div className="mt-2 p-2 border rounded-lg bg-muted text-muted-foreground text-sm">
                                Fichier joint: {msg.file.name}
                            </div>
                        )}
                    </>
                );
            } else {
                const finalHtml = textContent.replace(/\n/g, '<br />');
                contentNode = <p className="!my-0" dangerouslySetInnerHTML={{ __html: finalHtml }} />;
            }
            
            return {
              id: id,
              role: role as DisplayMessage['role'],
              content: contentNode,
              text_content: textContent,
            };
        })
        .filter((m): m is DisplayMessage => m !== null);
  };

  const displayConversations: DisplayConversation[] = conversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    messages: [], 
  }));

  const activeDisplayConversation = activeConversation ? {
    id: activeConversation.id,
    title: activeConversation.title,
    messages: toDisplayMessages(activeConversation.messages),
  } : null;

  const initialCocotalkMessages: DisplayMessage[] = [];
  if (activeCocotalk?.greetingMessage) {
    initialCocotalkMessages.push({
      id: 'greeting',
      role: 'assistant',
      content: <p className="!my-0">{activeCocotalk.greetingMessage}</p>,
      text_content: activeCocotalk.greetingMessage
    });
  } else if(activeCocotalk) {
     initialCocotalkMessages.push({
      id: 'greeting-default',
      role: 'assistant',
      content: <p className="!my-0">Hello! I'm your new assistant. How can I help you today?</p>,
      text_content: "Hello! I'm your new assistant. How can I help you today?"
    });
  }


  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          conversations={displayConversations}
          activeConversationId={activeConversationId}
          setActiveConversationId={selectConversation}
          createNewChat={createNewChat}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          cocotalks={cocotalks}
          activeCocotalkId={activeCocotalkId}
          setActiveCocotalkId={selectCocotalk}
          createNewCocotalk={handleCreateCocotalk}
          updateCocotalk={handleUpdateCocotalk}
          deleteCocotalk={handleDeleteCocotalk}
        />
        <main className="flex flex-1 flex-col">
          {activeDisplayConversation ? (
            <ChatPanel
              key={activeConversationId}
              messages={activeDisplayConversation.messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          ) : activeCocotalk ? (
            <ChatPanel
             key={activeCocotalk.id}
             messages={initialCocotalkMessages}
             onSendMessage={handleSendMessage}
             isLoading={isLoading}
             activeCocotalk={activeCocotalk}
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
