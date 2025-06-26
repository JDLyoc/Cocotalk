
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
import type { StoredMessage } from "@/app/page";
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

/**
 * Injects file context into the last user message of the history.
 */
async function processAndInjectFileContext(
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

    const newHistory = [...history];
    const lastUserMessageIndex = newHistory.map(m => m.role).lastIndexOf('user');

    if (lastUserMessageIndex !== -1) {
        const userMessage = newHistory[lastUserMessageIndex];
        // Prepend context to the last user message.
        userMessage.content = `${contextText}\n\nMessage de l'utilisateur: ${userMessage.content}`.trim();
    } else {
        // This case should ideally not happen if client-side validation is good,
        // but as a fallback, create a new user message.
        newHistory.push({
            role: 'user',
            content: contextText,
        });
    }
    
    return newHistory;
}


// ===== CORE CHAT LOGIC =====
interface BaseChatInput {
  messages: StoredMessage[];
  file: File | null;
  model: string;
}

interface CocotalkChatInput extends BaseChatInput {
  persona?: string;
  rules: string;
}

async function handleChat(
    history: StoredMessage[],
    file: File | null,
    model: string,
    cocotalkContext?: { persona?: string; rules: string; }
): Promise<{ response: string | null; error: string | null }> {
    try {
        let processedHistory: Message[] = history.map(({ role, content }) => ({ role, content }));

        // Step 1: Inject file context if a file is provided
        if (file) {
            processedHistory = await processAndInjectFileContext(processedHistory, file, model);
        }

        // Step 2: Call the Genkit flow with the processed history
        const { response, error } = await multilingualChat({
            messages: processedHistory,
            persona: cocotalkContext?.persona,
            rules: cocotalkContext?.rules,
            model: model,
        });

        // Step 3: Handle the response from the flow
        if (error) {
            return { response: null, error };
        }

        return { response, error: null };

    } catch (error: any) {
        console.error("Critical error in handleChat:", error);
        return { response: null, error: error.message || "Une erreur inconnue est survenue." };
    }
}


// ===== EXPORTED SERVER ACTIONS (WRAPPERS) =====

/**
 * Handles a standard chat conversation.
 */
export async function standardChat(input: BaseChatInput): Promise<{ response: string | null; error: string | null }> {
  return handleChat(input.messages, input.file, input.model);
}

/**
 * Handles a conversation with a custom assistant (Cocotalk).
 */
export async function cocotalkChat(input: CocotalkChatInput): Promise<{ response: string | null; error: string | null }> {
  const cocotalkContext = {
    persona: input.persona,
    rules: input.rules,
  };
  return handleChat(input.messages, input.file, input.model, cocotalkContext);
}
