
"use client";

import * as React from "react";
import { useRouter } from 'next/navigation';
import { AppSidebar } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { invokeAiChat } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from "@/components/app-header";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
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
  setDoc,
  arrayUnion,
} from "firebase/firestore";
import type {
  StoredMessage,
  StoredConversation,
  StoredCocotalk,
  DisplayMessage,
  DisplayConversation,
} from "@/lib/types";
import type { CocotalkFormValues } from "@/components/cocotalk-form";

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
  const router = useRouter();
  
  const [conversations, setConversations] = React.useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [cocotalks, setCocotalks] = React.useState<StoredCocotalk[]>([]);
  const [activeCocotalkId, setActiveCocotalkId] = React.useState<string | null>(null);

  const [isLoading, setIsLoading] = React.useState(false);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [isDataLoading, setIsDataLoading] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeCocotalk = cocotalks.find(c => c.id === activeCocotalkId);
  
  // Effect 1: Handle auth state changes and redirection
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in.
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
        setCurrentUser(user);
      } else {
        // User is signed out, redirect to login.
        setCurrentUser(null);
        router.push('/login');
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [router]);

  // Effect 2: Fetch conversations when user is authenticated.
  React.useEffect(() => {
    if (!currentUser) return;

    setIsDataLoading(true);
    const q = query(
        collection(db, "users", currentUser.uid, "conversations"),
        orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const conversationsData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as StoredConversation));
        setConversations(conversationsData);
        setIsDataLoading(false);
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
  }, [currentUser, toast]);

  // Effect 3: Set the initial active conversation after data has loaded.
  React.useEffect(() => {
    if (!isDataLoading && conversations.length > 0 && !activeConversationId && !activeCocotalkId) {
        setActiveConversationId(conversations[0].id);
    }
  }, [isDataLoading, conversations, activeConversationId, activeCocotalkId]);


  // Effect 4: Fetch cocotalks when user is authenticated.
  React.useEffect(() => {
    if (!currentUser) return;
    
    const q = query(
      collection(db, "users", currentUser.uid, "cocotalks"),
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
  }, [currentUser, toast]);

  const handleSendMessage = async (text: string, file: File | null) => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Erreur", description: "Utilisateur non authentifié." });
      return;
    }
    
    const messageContent = text.trim();
    if (!messageContent && !file) {
      return;
    }

    setIsLoading(true);

    const userMessageForDb: StoredMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: messageContent,
    };
    
    const currentConversationId = activeConversationId;
    const historyForAI = [...(activeConversation?.messages || []), userMessageForDb];

    try {
      const aiResult = await invokeAiChat({
          historyWithNewMessage: historyForAI,
          model: model,
          activeCocotalk: activeCocotalk || null,
      });

      if (aiResult.error || !aiResult.response) {
        toast({
          variant: "destructive",
          title: "Erreur de l'IA",
          description: aiResult.error || "L'IA n'a pas pu générer de réponse.",
        });
        setIsLoading(false);
        return;
      }
      
      const modelMessageForDb: StoredMessage = {
          id: `model_${Date.now() + 1}`,
          role: 'model',
          content: aiResult.response,
      };

      if (currentConversationId) {
        const convRef = doc(db, "users", currentUser.uid, "conversations", currentConversationId);
        await updateDoc(convRef, {
            messages: arrayUnion(userMessageForDb, modelMessageForDb)
        });

      } else {
        const newTitle = activeCocotalk?.title || messageContent.substring(0, 30).trim() || "Nouvelle Conversation";
        
        const newConvRef = await addDoc(collection(db, "users", currentUser.uid, "conversations"), {
            title: newTitle,
            messages: [userMessageForDb, modelMessageForDb],
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
            ...(activeCocotalk && { cocotalkOriginId: activeCocotalk.id }),
        });
        
        selectConversation(newConvRef.id);
      }

    } catch (e: any) {
      console.error("Erreur inattendue dans handleSendMessage:", e);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e.message || "Une erreur est survenue. Veuillez réessayer.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = async () => {
    if (!currentUser) return;
    setActiveCocotalkId(null);
    setActiveConversationId(null);
  }
  
  const handleRenameConversation = async (id: string, title: string) => {
    if (!currentUser) return;
    const convRef = doc(db, "users", currentUser.uid, "conversations", id);
    try {
        await updateDoc(convRef, { title });
    } catch (error) {
        console.error("Error renaming conversation:", error);
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de renommer la conversation.' });
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!currentUser) return;
    
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
    
    const convRef = doc(db, "users", currentUser.uid, "conversations", id);
    try {
        await deleteDoc(convRef);
    } catch (error) {
        console.error("Error deleting conversation:", error);
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer la conversation.' });
    }
  };
  
  const handleCreateCocotalk = async (values: CocotalkFormValues) => {
    if (!currentUser) {
        toast({
            variant: 'destructive',
            title: 'Erreur d\'authentification',
            description: 'Veuillez patienter ou rafraîchir la page et réessayer.',
        });
        return;
    }
    try {
      const docRef = await addDoc(collection(db, "users", currentUser.uid, "cocotalks"), {
        ...values,
        createdAt: serverTimestamp(),
        userId: currentUser.uid,
      });
      toast({ title: 'Succès', description: 'Cocotalk créé avec succès.' });
      selectCocotalk(docRef.id);
    } catch (error) {
      console.error("Error creating new cocotalk:", error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de créer le Cocotalk.' });
    }
  };

  const handleUpdateCocotalk = async (id: string, values: CocotalkFormValues) => {
    if (!currentUser) return;
    const cocotalkRef = doc(db, "users", currentUser.uid, "cocotalks", id);
    try {
      await updateDoc(cocotalkRef, values as any);
      toast({ title: 'Succès', description: 'Cocotalk mis à jour avec succès.' });
    } catch (error) {
      console.error("Error updating cocotalk:", error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le Cocotalk.' });
    }
  };

  const handleDeleteCocotalk = async (id: string) => {
    if (!currentUser) return;
    if (activeCocotalkId === id) {
      selectCocotalk(null);
    }
    const cocotalkRef = doc(db, "users", currentUser.uid, "cocotalks", id);
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

  // Show skeleton while auth state is being determined or data is loading.
  if (!isAuthReady || !currentUser || (conversations.length === 0 && isDataLoading)) {
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
