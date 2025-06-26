
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import type { StoredMessage } from "@/app/page";
import type { Message } from "genkit";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";

// Note: File processing logic is temporarily removed to isolate the core issue.
// We will add it back once the basic conversation flow is stable.

interface CocotalkContext {
    originId: string;
    title: string;
    persona?: string;
    instructions: string;
}

interface ProcessMessageInput {
  userId: string;
  conversationId: string | null;
  messageContent: string;
  model: string;
  currentMessages: StoredMessage[];
  cocotalkContext: CocotalkContext | null;
}

export async function processUserMessage(input: ProcessMessageInput): Promise<{ newConversationId?: string; error?: string }> {
    const { userId, conversationId, messageContent, model, currentMessages, cocotalkContext } = input;

    try {
        // Step 1: Prepare user message for AI and database
        const userMessageForDb: StoredMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: messageContent,
        };
        
        const historyForAI = [...currentMessages, userMessageForDb].map(m => ({ 
            role: m.role, 
            content: m.content 
        })) as Message[];

        // Step 2: Call the AI
        const aiResult = await multilingualChat({
            messages: historyForAI,
            persona: cocotalkContext?.persona,
            rules: cocotalkContext?.instructions,
            model: model,
        });

        if (aiResult.error || !aiResult.response) {
            return { error: aiResult.error || "L'IA n'a pas pu générer de réponse." };
        }

        const modelMessageForDb: StoredMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: aiResult.response,
        };

        // Step 3: Save to Firestore
        if (conversationId) {
            // Update existing conversation
            const conversationRef = doc(db, "users", userId, "conversations", conversationId);
            await updateDoc(conversationRef, {
                messages: arrayUnion(userMessageForDb, modelMessageForDb)
            });
            return { newConversationId: conversationId };
        } else {
            // Create new conversation
            const newTitle = cocotalkContext?.title || messageContent.substring(0, 30).trim() || "Nouvelle Conversation";
            const newConvData = {
                title: newTitle,
                messages: [userMessageForDb, modelMessageForDb],
                userId: userId,
                createdAt: serverTimestamp(),
                ...(cocotalkContext && { cocotalkOriginId: cocotalkContext.originId }),
            };
            const conversationRef = await addDoc(collection(db, "users", userId, "conversations"), newConvData);
            return { newConversationId: conversationRef.id };
        }

    } catch (error: any) {
        console.error("Critical error in processUserMessage:", error);
        // Check for specific Firestore permission errors
        if (error.code === 'permission-denied') {
            return { error: "Erreur de permission. Vérifiez les règles de sécurité de Firestore." };
        }
        return { error: error.message || "Une erreur inconnue est survenue." };
    }
}
