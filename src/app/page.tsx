
"use client";

import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { standardChat, cocotalkChat } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from "@/components/app-header";
import { auth, db } from "@/lib/firebase";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useModel } from "@/contexts/model-context";
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

// Interface for messages passed to components (with ReactNode)
export interface DisplayMessage {
  id: string;
  role: "user" | "model";
  content: React.ReactNode;
  text_content?: string;
}

// Interface for messages stored in Firestore
export interface StoredMessage {
  id: string;
  role: "user" | "model";
  content: string;
  file?: {
      name: string;
      type: string;
  };
}

// Interface for messages sent to API
export interface ApiMessage {
  role: "user" | "model";
  content: string;
  file?: { name: string; type: string; };
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
  instructions: string;
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
  const { model } = useModel();
  
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

const handleNormalMessage = async (text: string, file: File | null) => {
  const userId = auth.currentUser!.uid;
  let convId = activeConversationId;
  let conversationRef;
  let currentHistory: StoredMessage[] = [];

  // Step 1: Get or create conversation
  if (convId) {
    conversationRef = doc(db, "users", userId, "conversations", convId);
    const currentConv = conversations.find(c => c.id === convId);
    currentHistory = currentConv?.messages ? [...currentConv.messages] : [];
  } else {
    const newTitle = text.substring(0, 30).trim() + (text.length > 30 ? '...' : '') || file?.name || "Nouvelle Conversation";
    const newConvData = {
      title: newTitle,
      messages: [],
      userId: userId,
      createdAt: serverTimestamp(),
    };
    conversationRef = await addDoc(collection(db, "users", userId, "conversations"), newConvData);
    convId = conversationRef.id;
    selectConversation(convId);
  }

  // Step 2: Create a valid user message
  const messageContent = text.trim() || (file ? `Analyse du fichier: ${file.name}` : "");
  const userMessage: StoredMessage = {
    id: Date.now().toString(),
    role: "user",
    content: messageContent,
    ...(file && { file: { name: file.name, type: file.type } }),
  };

  const updatedHistory = [...currentHistory, userMessage];
  await updateDoc(conversationRef, { messages: updatedHistory });

  // Step 3: Call server action
  const apiHistory = updatedHistory.map(({ role, content, file: fileInfo }) => ({
    role: role as 'user' | 'model',
    content,
    ...(fileInfo && { file: fileInfo })
  }));

  const { response, error } = await standardChat({
    messages: apiHistory,
    file,
    model,
  });

  if (error) {
    toast({ variant: "destructive", title: "Erreur de l'IA", description: error });
    // Remove the user message we just added to avoid a broken state
    await updateDoc(conversationRef, { messages: currentHistory });
    return;
  }

  // Step 4: Create model message and update Firestore again
  const modelMessage: StoredMessage = {
    id: (Date.now() + 1).toString(),
    role: 'model',
    content: response || 'Désolé, je n\'ai pas pu générer de réponse.',
  };
  await updateDoc(conversationRef, { messages: [...updatedHistory, modelMessage] });
};
  
const handleCocotalkMessage = async (text: string, file: File | null) => {
  if (!activeCocotalk) return;

  const userId = auth.currentUser!.uid;
  let convId = activeConversationId;
  let conversationRef;
  let currentHistory: StoredMessage[] = [];

  // Step 1: Get or create conversation
  if (convId) {
    conversationRef = doc(db, "users", userId, "conversations", convId);
    const currentConv = conversations.find(c => c.id === convId);
    currentHistory = currentConv?.messages ? [...currentConv.messages] : [];
  } else {
    const newConvData = {
      title: activeCocotalk.title,
      messages: [],
      userId: userId,
      createdAt: serverTimestamp(),
      cocotalkOriginId: activeCocotalk.id,
    };
    conversationRef = await addDoc(collection(db, "users", userId, "conversations"), newConvData);
    convId = conversationRef.id;
    selectConversation(convId);
  }

  // Step 2: Create a valid user message
  const messageContent = text.trim() || (file ? `Analyse du fichier: ${file.name}` : "");
  const userMessage: StoredMessage = {
    id: Date.now().toString(),
    role: "user",
    content: messageContent,
    ...(file && { file: { name: file.name, type: file.type } }),
  };

  const updatedHistory = [...currentHistory, userMessage];
  await updateDoc(conversationRef, { messages: updatedHistory });

  // Step 3: Call server action
  const apiHistory = updatedHistory.map(({ role, content, file: fileInfo }) => ({
    role: role as 'user' | 'model',
    content,
    ...(fileInfo && { file: fileInfo })
  }));

  const { response, error } = await cocotalkChat({
    messages: apiHistory,
    file,
    persona: activeCocotalk.persona,
    rules: activeCocotalk.instructions,
    model,
  });

  if (error) {
    toast({ variant: "destructive", title: "Erreur de l'IA", description: error });
    // Remove the user message we just added to avoid a broken state
    await updateDoc(conversationRef, { messages: currentHistory });
    return;
  }

  // Step 4: Create model message and update Firestore again
  const modelMessage: StoredMessage = {
    id: (Date.now() + 1).toString(),
    role: 'model',
    content: response || 'Désolé, je n\'ai pas pu générer de réponse.',
  };
  await updateDoc(conversationRef, { messages: [...updatedHistory, modelMessage] });
};

const handleSendMessage = async (text: string, file: File | null) => {
    if (!auth.currentUser) {
        toast({ variant: "destructive", title: "Erreur", description: "Utilisateur non authentifié." });
        return;
    }
    if (!text.trim() && !file) return;

    setIsLoading(true);

    try {
        if (activeCocotalk) {
            await handleCocotalkMessage(text, file);
        } else {
            await handleNormalMessage(text, file);
        }
    } catch (e: any) {
        console.error("Erreur inattendue dans handleSendMessage:", e);
        toast({
            variant: "destructive",
            title: "Erreur Inattendue",
            description: e.message || "Une erreur est survenue. Veuillez réessayer.",
        });
    } finally {
        setIsLoading(false);
    }
};

  const createNewChat = async () => {
    if (!auth.currentUser) return;
    setActiveCocotalkId(null);
    setActiveConversationId(null);
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
        .map((msg) => {
            if (!msg || typeof msg !== 'object') {
                return null;
            }
            
            const { id, role, content } = msg;

            if (typeof id !== 'string' || !['user', 'model'].includes(role)) {
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
            } else { // role === 'model'
                const finalHtml = textContent.replace(/\n/g, '<br />');
                contentNode = <p className="!my-0" dangerouslySetInnerHTML={{ __html: finalHtml }} />;
            }
            
            return {
              id: id,
              role: role,
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
  if (activeCocotalk && !activeConversationId) {
    const greetingText = activeCocotalk.greetingMessage || "Bonjour! Je suis votre nouvel assistant. Comment puis-je vous aider aujourd'hui ?";
    initialCocotalkMessages.push({
      id: 'greeting-ui-only',
      role: 'model',
      content: <p className="!my-0">{greetingText}</p>,
      text_content: greetingText
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

    