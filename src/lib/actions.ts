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
  getDocs,
  writeBatch
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
  messageContent: string;
  file: File | null;
  model: string;
  currentMessages: StoredMessage[];
  cocotalkContext: CocotalkContext | null;
}

export async function processUserMessage(input: ProcessMessageInput): Promise<{ newConversationId?: string; error?: string }> {
    const { userId, conversationId, messageContent, file, model, currentMessages, cocotalkContext } = input;

    console.log('Processing message:', {
        userId,
        conversationId,
        messageContent: messageContent.substring(0, 50) + '...',
        hasFile: !!file,
        model,
        currentMessagesCount: currentMessages?.length || 0,
        hasCocotalkContext: !!cocotalkContext
    });

    try {
        let finalContent = messageContent;

        // Step 1: Process file if it exists
        if (file) {
            let contextText = "";
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
                return { error: `Erreur lors du traitement du fichier: ${error.message}` };
            }
            finalContent = `${contextText}\n\nMessage de l'utilisateur: ${messageContent}`.trim();
        }
        
        // Step 2: Prepare user message for AI and database
        const userMessageForDb: StoredMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: finalContent,
            ...(file && { file: { name: file.name, type: file.type } }),
        };
        
        // Ensure we have valid messages for AI
        const validCurrentMessages = Array.isArray(currentMessages) ? currentMessages : [];
        const historyForAI = [...validCurrentMessages, userMessageForDb].map(m => ({ 
            role: m.role, 
            content: m.content 
        })) as Message[];

        console.log('Prepared history for AI:', {
            totalMessages: historyForAI.length,
            messages: historyForAI.map(m => ({ role: m.role, contentLength: m.content?.length || 0 }))
        });

        // Step 3: Call the AI
        const aiResult = await multilingualChat({
            messages: historyForAI,
            persona: cocotalkContext?.persona,
            rules: cocotalkContext?.instructions,
            model: model,
        });

        console.log('AI result:', { hasResponse: !!aiResult.response, hasError: !!aiResult.error });

        if (aiResult.error) {
            return { error: aiResult.error };
        }

        const modelMessageForDb: StoredMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: aiResult.response || 'Désolé, je n\'ai pas pu générer de réponse.',
        };

        // Step 4: Save to Firestore
        let finalConversationId = conversationId;

        if (finalConversationId) {
            // Update existing conversation
            console.log('Updating existing conversation:', finalConversationId);
            const conversationRef = doc(db, "users", userId, "conversations", finalConversationId);
            await updateDoc(conversationRef, {
                messages: arrayUnion(userMessageForDb, modelMessageForDb)
            });
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
            console.log('Creating new conversation with title:', newTitle);
            const conversationRef = await addDoc(collection(db, "users", userId, "conversations"), newConvData);
            finalConversationId = conversationRef.id;
            console.log('New conversation created with ID:', finalConversationId);
        }

        return { newConversationId: finalConversationId };

    } catch (error: any) {
        console.error("Critical error in processUserMessage:", error);
        return { error: error.message || "Une erreur inconnue est survenue." };
    }
}

