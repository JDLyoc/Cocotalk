
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
import type { StoredCocotalk } from "@/app/page";
import type { Message } from "genkit";

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

async function processFileAndInjectContext(
    history: Message[],
    file: File,
    model: string
): Promise<Message[]> {
    let contextText = "";
    try {
        if (file.type.startsWith("image/")) {
            const photoDataUri = await fileToDataUri(file);
            const { description } = await decodeImage({ photoDataUri, model });
            contextText = `Contexte de l'image jointe (${file.name}): ${description}.`;
        } else {
            const documentContent = await extractTextFromFile(file);
            if (!documentContent.trim()) {
                throw new Error(`Le fichier ${file.name} est vide ou illisible.`);
            }
            const { summary } = await summarizeDocument({ documentContent, format: "text", model });
            contextText = `Contexte du document (${file.name}): ${summary}.`;
        }
    } catch (error: any) {
        console.error("Error processing file:", error);
        throw new Error(`Erreur lors du traitement du fichier: ${error.message}`);
    }

    const lastUserMessageIndex = history.map(m => m.role).lastIndexOf('user');
    if (lastUserMessageIndex !== -1) {
        const newHistory = [...history];
        const userMessage = newHistory[lastUserMessageIndex];
        userMessage.content = `${contextText}\n\nMessage de l'utilisateur: ${userMessage.content}`.trim();
        return newHistory;
    }
    
    // Fallback if no user message exists (e.g., file sent with no text)
    const contextMessage: Message = {
        role: 'user',
        content: contextText,
    };
    return [...history, contextMessage];
}

// ===== CORE CHAT LOGIC =====

interface StandardChatInput {
  messages: Message[];
  model: string;
  file?: File | null;
}

interface CocotalkChatInput extends StandardChatInput {
  persona?: string;
  rules: string;
}

/**
 * Central function to handle all chat requests.
 * It processes files and calls the appropriate AI flow.
 */
async function handleChat(
    history: Message[],
    file: File | null,
    cocotalkContext: Pick<StoredCocotalk, 'persona' | 'instructions'> | undefined,
    model: string
) {
    try {
        let processedHistory = history;
        if (file) {
            processedHistory = await processFileAndInjectContext(history, file, model);
        }
        
        const chatResult = await multilingualChat({
            messages: processedHistory,
            persona: cocotalkContext?.persona,
            rules: cocotalkContext?.instructions,
            model: model,
        });

        if (chatResult.error) {
            return { response: null, error: chatResult.error };
        }

        return { response: chatResult.response, error: null };

    } catch (error: any) {
        console.error("Critical error in handleChat:", error);
        return { response: null, error: error.message || "Une erreur inconnue est survenue." };
    }
}

// ===== EXPORTED SERVER ACTIONS (WRAPPERS) =====

/**
 * Handles a standard chat conversation.
 * This is a wrapper for the core chat handler.
 */
export async function standardChat(input: StandardChatInput): Promise<{ response: string | null; error: string | null }> {
  return handleChat(input.messages, input.file || null, undefined, input.model);
}

/**
 * Handles a conversation with a custom assistant (Cocotalk).
 * This is a wrapper for the core chat handler.
 */
export async function cocotalkChat(input: CocotalkChatInput): Promise<{ response: string | null; error: string | null }> {
  const cocotalkContext = {
    persona: input.persona,
    instructions: input.rules,
  };
  return handleChat(input.messages, input.file || null, cocotalkContext, input.model);
}
