
"use server";

// Import the AI flow
import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
import type { StoredCocotalk, StoredMessage } from "@/app/page";
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

    // Lazy-load parsers to reduce cold start time
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
    history: StoredMessage[],
    file: File,
    model: string
): Promise<StoredMessage[]> {
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
    
    // If no user message (e.g., file sent with no text), create one with the context
    const contextMessage: StoredMessage = {
        id: `context-${Date.now()}`,
        role: 'user',
        content: contextText,
        file: { name: file.name, type: file.type }
    };

    return [...history, contextMessage];
}

// ===== HISTORY SANITIZATION =====
function sanitizeHistoryForApi(history: StoredMessage[]): Message[] {
    // 1. Filter out any fundamentally invalid messages
    const validMessages = history.filter(msg =>
        msg &&
        (msg.role === 'user' || msg.role === 'model') &&
        typeof msg.content === 'string' &&
        msg.content.trim() !== ''
    );

    if (validMessages.length === 0) return [];

    // 2. Ensure roles alternate, starting with a user message
    const alternatingHistory: Message[] = [];
    let lastRole: string | null = null;

    for (const message of validMessages) {
        if (message.role === lastRole) {
            // A 'user' message can't follow a 'user' message. Overwrite the last one.
            if(alternatingHistory.length > 0) {
              alternatingHistory[alternatingHistory.length - 1] = {
                  role: message.role,
                  content: message.content
              };
            }
        } else {
            alternatingHistory.push({
                role: message.role,
                content: message.content
            });
            lastRole = message.role;
        }
    }

    // 3. Ensure the very first message is from the user
    const firstUserIndex = alternatingHistory.findIndex(m => m.role === 'user');
    if (firstUserIndex === -1) {
      return []; // No user messages, invalid history
    }

    return alternatingHistory.slice(firstUserIndex);
}

// ===== CORE CHAT HANDLER =====
async function handleChat(
    history: StoredMessage[],
    file: File | null,
    cocotalkContext: StoredCocotalk | undefined,
    model: string
) {
    try {
        let processedHistory = history;
        if (file) {
            processedHistory = await processFileAndInjectContext(history, file, model);
        }

        const historyForGenkit = sanitizeHistoryForApi(processedHistory);

        if (historyForGenkit.length === 0) {
            // This is a critical guard. If sanitization results in an empty history, we can't proceed.
            throw new Error("L'historique des messages est invalide ou vide après nettoyage.");
        }

        const chatResult = await multilingualChat({
            messages: historyForGenkit,
            persona: cocotalkContext?.persona,
            rules: cocotalkContext?.instructions,
            model: model,
        });

        return { response: chatResult.response, error: null };

    } catch (error: any) {
        console.error("Error in handleChat:", error);
        return { response: '', error: error.message || "Une erreur inconnue est survenue lors de la communication avec l'IA." };
    }
}

// ===== EXPORTED SERVER ACTIONS (WRAPPERS) =====
// These are called by page.tsx

/**
 * Handles a standard chat conversation.
 */
export async function standardChat(
  history: StoredMessage[], 
  file: File | null,
  model: string
) {
  return handleChat(history, file, undefined, model);
}

/**
 * Handles a conversation with a custom assistant (Cocotalk).
 */
export async function cocotalkChat(
  history: StoredMessage[], 
  file: File | null,
  cocotalkContext: StoredCocotalk,
  model: string
) {
  return handleChat(history, file, cocotalkContext, model);
}
