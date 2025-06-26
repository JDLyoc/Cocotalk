
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
        let historyForAI: Message[] = [];

        // Step 1: Fetch existing conversation from DB if conversationId is provided.
        if (conversationId) {
            const conversationRef = doc(db, "users", userId, "conversations", conversationId);
            const conversationSnap = await getDoc(conversationRef);

            if (conversationSnap.exists()) {
                const conversationData = conversationSnap.data();
                const existingMessages: StoredMessage[] = conversationData.messages || [];
                historyForAI = existingMessages.map((m) => ({
                    role: m.role,
                    content: m.content,
                }));
            }
        }
        
        // Add the new user message to the history for the AI.
        historyForAI.push({ role: 'user', content: messageContent });

        // Step 2: Call the AI.
        const aiResult = await multilingualChat({
            messages: historyForAI,
            persona: activeCocotalk?.persona,
            rules: activeCocotalk?.instructions,
            model: model,
        });

        if (aiResult.error || !aiResult.response) {
            return { error: aiResult.error || "L'IA n'a pas pu générer de réponse." };
        }

        // Prepare messages for DB
        const userMessageForDb: StoredMessage = {
            id: `user_${Date.now()}`,
            role: 'user',
            content: messageContent,
        };
        const modelMessageForDb: StoredMessage = {
            id: `model_${Date.now() + 1}`,
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
        console.error("Critical error in processUserMessage:", error);
        if (error.code === 'permission-denied') {
            return { error: "Erreur de permission. Vérifiez les règles de sécurité de Firestore." };
        }
        return { error: error.message || "Une erreur inconnue est survenue." };
    }
}
