
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
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

// ===== FILE PROCESSING UTILITIES =====
async function fileToDataUri(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${file.type};base64,${base64}`;
}

async function extractTextFromFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { default: pdf } = await import('pdf-parse');
    const { default: mammoth } = await import('mammoth');
    const { default: xlsx } = await import('xlsx');

    switch (file.type) {
        case 'text/plain':
            return buffer.toString('utf-8');
        case 'application/pdf':
            const data = await pdf(buffer);
            return data.text;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            const docxResult = await mammoth.extractRawText({ buffer });
            return docxResult.value;
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            let fullText = '';
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const sheetText = xlsx.utils.sheet_to_txt(sheet);
                fullText += `Fiche: ${sheetName}\n${sheetText}\n\n`;
            });
            return fullText;
        default:
            throw new Error(`Type de fichier non supporté pour l'extraction de texte : ${file.type}`);
    }
}

/**
 * Injects file context into the user message content.
 */
async function processAndInjectFileContext(
    userMessage: StoredMessage,
    file: File,
    model: string
): Promise<StoredMessage> {
    let contextText = "";
    const updatedMessage = { ...userMessage };

    try {
        if (file.type.startsWith("image/")) {
            const photoDataUri = await fileToDataUri(file);
            const { description } = await decodeImage({ photoDataUri, model });
            contextText = `Contexte de l'image jointe (${file.name}): ${description}.`;
        } else {
            const documentContent = await extractTextFromFile(file);
            if (!documentContent.trim()) {
                contextText = `Le fichier joint (${file.name}) est vide ou ne contient pas de texte lisible.`;
            } else {
                const { summary } = await summarizeDocument({ documentContent, format: "text", model });
                contextText = `Contexte du document (${file.name}): ${summary}.`;
            }
        }
    } catch (error: any) {
        console.error("Error processing file:", error);
        throw new Error(`Erreur lors du traitement du fichier: ${error.message}`);
    }
    
    // Prepend context to the user message.
    updatedMessage.content = `${contextText}\n\nMessage de l'utilisateur: ${updatedMessage.content}`.trim();
    return updatedMessage;
}


// ===== CORE CHAT LOGIC =====
interface CocotalkContext {
    originId: string;
    title: string;
    persona?: string;
    instructions: string;
}

interface ProcessMessageInput {
  userId: string;
  conversationId: string | null;
  message: StoredMessage;
  file: File | null;
  model: string;
  cocotalkContext: CocotalkContext | null;
}

export async function processUserMessage(input: ProcessMessageInput): Promise<{ newConversationId?: string; error?: string }> {
    const { userId, conversationId, message, file, model, cocotalkContext } = input;

    try {
        let userMessageToProcess = message;
        
        if (file) {
            userMessageToProcess = await processAndInjectFileContext(message, file, model);
        }

        const historyForAI: Message[] = [];
        if (conversationId) {
            // In a real app, you would fetch existing messages here.
            // For this flow, we assume the client manages history and we just need the new message.
        }
        historyForAI.push({ role: userMessageToProcess.role, content: userMessageToProcess.content });

        const aiResult = await multilingualChat({
            messages: historyForAI,
            persona: cocotalkContext?.persona,
            rules: cocotalkContext?.instructions,
            model: model,
        });

        if (aiResult.error) {
            return { error: aiResult.error };
        }

        const modelMessage: StoredMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: aiResult.response || 'Désolé, je n\'ai pas pu générer de réponse.',
        };

        let finalConversationId = conversationId;

        if (finalConversationId) {
            // Update existing conversation
            const conversationRef = doc(db, "users", userId, "conversations", finalConversationId);
            await updateDoc(conversationRef, {
                messages: arrayUnion(userMessageToProcess, modelMessage)
            });
        } else {
            // Create new conversation
            const newTitle = cocotalkContext?.title || userMessageToProcess.content.substring(0, 30).trim() || "Nouvelle Conversation";
            const newConvData = {
                title: newTitle,
                messages: [userMessageToProcess, modelMessage],
                userId: userId,
                createdAt: serverTimestamp(),
                ...(cocotalkContext && { cocotalkOriginId: cocotalkContext.originId }),
            };
            const conversationRef = await addDoc(collection(db, "users", userId, "conversations"), newConvData);
            finalConversationId = conversationRef.id;
        }

        return { newConversationId: finalConversationId };

    } catch (error: any) {
        console.error("Critical error in processUserMessage:", error);
        return { error: error.message || "Une erreur inconnue est survenue." };
    }
}
