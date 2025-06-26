
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import type { StoredMessage, StoredCocotalk } from "@/lib/types";
import type { Message } from "genkit";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  getDoc,
} from "firebase/firestore";

interface ProcessMessageInput {
  userId: string;
  conversationId: string | null;
  messageContent: string;
  model: string;
  activeCocotalk: StoredCocotalk | null;
}

export async function processUserMessage(input: ProcessMessageInput): Promise<{ newConversationId?: string; error?: string }> {
    const { userId, conversationId, messageContent, model, activeCocotalk } = input;

    try {
        // TEST: Bypassing the AI call as suggested by the user.
        const aiResponse = "Ceci est une réponse de test pour vérifier la sauvegarde.";

        const userMessageForDb: StoredMessage = {
            id: `user_${Date.now()}`,
            role: 'user',
            content: messageContent,
        };
        const modelMessageForDb: StoredMessage = {
            id: `model_${Date.now() + 1}`,
            role: 'model',
            content: aiResponse,
        };

        if (conversationId) {
            // This part is for existing conversations, our test focuses on new ones.
            const conversationRef = doc(db, "users", userId, "conversations", conversationId);
            await updateDoc(conversationRef, {
                messages: arrayUnion(userMessageForDb, modelMessageForDb)
            });
            return { newConversationId: conversationId };
        } else {
            // This is the critical part for our test: creating a new conversation.
            const newTitle = activeCocotalk?.title || messageContent.substring(0, 30).trim() || "Nouvelle Conversation";
            
            const newConvData = {
                title: newTitle,
                messages: [userMessageForDb, modelMessageForDb],
                userId: userId,
                createdAt: serverTimestamp(),
                ...(activeCocotalk && { cocotalkOriginId: activeCocotalk.id }),
            };
            const conversationRef = await addDoc(collection(db, "users", userId, "conversations"), newConvData);
            return { newConversationId: conversationRef.id };
        }

    } catch (error: any) {
        console.error("Critical error in processUserMessage (test mode):", error);
        if (error.code === 'permission-denied') {
            return { error: "Erreur de permission. Vérifiez les règles de sécurité de Firestore." };
        }
        return { error: `Une erreur de sauvegarde est survenue: ${error.message}` };
    }
}
