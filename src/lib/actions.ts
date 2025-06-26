
"use server";
     
import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
import type { StoredCocotalk, StoredMessage } from "@/app/page";
import type { Message } from "genkit";

const mammoth = require('mammoth');
import * as xlsx from 'xlsx';

// File Processing Utilities
async function fileToDataUri(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

async function extractTextFromFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    switch (file.type) {
        case 'text/plain':
            return buffer.toString('utf-8');
            
        case 'application/pdf': {
            const pdf = require('pdf-parse');
            const data = await pdf(buffer);
            return data.text;
        }

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            const docxResult = await mammoth.extractRawText({ buffer: buffer });
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

// History Sanitization
function sanitizeHistoryForApi(history: StoredMessage[]): Message[] {
    const validMessages = history.filter(msg =>
        (msg.role === 'user' || msg.role === 'model') &&
        typeof msg.content === 'string' &&
        msg.content.trim() !== ''
    );

    if (validMessages.length === 0) return [];

    const alternatingHistory: Message[] = [];
    let lastRole = '';

    for (const message of validMessages) {
        if (message.role !== lastRole) {
            alternatingHistory.push({
                role: message.role,
                content: message.content
            });
            lastRole = message.role;
        }
    }

    if (alternatingHistory.length > 0 && alternatingHistory[0].role !== 'user') {
      const firstUserIndex = alternatingHistory.findIndex(m => m.role === 'user');
      if (firstUserIndex !== -1) {
        return alternatingHistory.slice(firstUserIndex);
      }
      return []; // No user messages, invalid history
    }

    return alternatingHistory;
}


async function processFileAndInjectContext(history: StoredMessage[], file: File, model: string): Promise<StoredMessage[]> {
    let contextText = "";
    try {
        if (file.type.startsWith("image/")) {
            const photoDataUri = await fileToDataUri(file);
            const description = await decodeImage({ photoDataUri, model });
            contextText = `Contexte de l'image jointe: ${description.description}.`;
        } else {
            const documentContent = await extractTextFromFile(file);
            if (!documentContent.trim()) {
                throw new Error(`Le fichier ${file.name} est vide ou illisible.`);
            }
            const summary = await summarizeDocument({ documentContent, format: "text", model });
            contextText = `Contexte du document (${file.name}): ${summary.summary}.`;
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

    return history;
}

// --- NEW SEPARATED SERVER ACTIONS ---

export async function standardChat(
  history: StoredMessage[], 
  file: File | null,
  model: string
) {
  try {
    let processedHistory = history;
    if (file) {
      processedHistory = await processFileAndInjectContext(history, file, model);
    }
    
    const historyForGenkit = sanitizeHistoryForApi(processedHistory);

    if (historyForGenkit.length === 0) {
      throw new Error("Cannot process a request with no valid messages after sanitization.");
    }
    
    const chatResult = await multilingualChat({ 
      messages: historyForGenkit,
      model: model,
    });
    
    return { response: chatResult.response, error: null };

  } catch (error: any) {
      console.error("Error in standardChat:", error);
      return { response: '', error: error.message || "Une erreur inconnue est survenue dans le chat." };
  }
}


export async function cocotalkChat(
  history: StoredMessage[], 
  file: File | null,
  cocotalkContext: StoredCocotalk,
  model: string
) {
  try {
    let processedHistory = history;
    if (file) {
      processedHistory = await processFileAndInjectContext(history, file, model);
    }
    
    const historyForGenkit = sanitizeHistoryForApi(processedHistory);
    
    if (historyForGenkit.length === 0) {
      throw new Error("Cannot process a request with no valid messages after sanitization.");
    }
    
    const chatResult = await multilingualChat({ 
      messages: historyForGenkit,
      persona: cocotalkContext?.persona,
      rules: cocotalkContext?.instructions,
      model: model,
    });
    
    return { response: chatResult.response, error: null };

  } catch (error: any) {
      console.error("Error in cocotalkChat:", error);
      return { response: '', error: error.message || "Une erreur inconnue est survenue dans le chat." };
  }
}
