
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
import type { StoredCocotalk, StoredMessage } from "@/app/page";
import type { Message } from "genkit";

const mammoth = require('mammoth');
import * as xlsx from 'xlsx';

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

/**
 * Sanitizes the conversation history to ensure it's valid for the Gemini API.
 * - Filters out invalid, system, or empty messages.
 * - Ensures roles strictly alternate between 'user' and 'model'.
 * - Maps 'assistant' role to 'model'.
 * - Ensures the conversation starts with a 'user' message.
 */
function sanitizeHistory(history: StoredMessage[]): Message[] {
    // 1. Filter for valid, non-empty messages and map roles.
    const mappedMessages: Message[] = history
        .map(msg => ({
            role: msg.role === 'assistant' ? 'model' : msg.role,
            content: msg.content
        }))
        .filter((msg): msg is Message =>
            (msg.role === 'user' || msg.role === 'model') &&
            typeof msg.content === 'string'
        );

    if (mappedMessages.length === 0) {
        return [];
    }
    
    // 2. Ensure roles alternate correctly.
    const alternatingHistory: Message[] = [];
    if (mappedMessages.length > 0) {
        // Start with the first message.
        alternatingHistory.push(mappedMessages[0]);
        // Iterate through the rest.
        for (let i = 1; i < mappedMessages.length; i++) {
            // If the role is different from the last one added, push it.
            if (mappedMessages[i].role !== alternatingHistory[alternatingHistory.length - 1].role) {
                alternatingHistory.push(mappedMessages[i]);
            }
        }
    }

    // 3. Ensure the conversation starts with a 'user' message.
    const firstUserIndex = alternatingHistory.findIndex(m => m.role === 'user');
    if (firstUserIndex === -1) {
        return []; // No user messages, history is invalid.
    }

    return alternatingHistory.slice(firstUserIndex);
}

export async function handleChat(
  history: StoredMessage[], 
  file: File | null,
  cocotalkContext: StoredCocotalk | undefined,
  model: string
) {

  try {
    // Sanitize the history provided by the client. This is the crucial step.
    let historyForGenkit = sanitizeHistory(history);

    // The user's most recent message is the last one in the history.
    // It should have been added by the client, so it's the last item.
    const lastUserMessage = historyForGenkit.length > 0 && historyForGenkit[historyForGenkit.length - 1].role === 'user' 
        ? historyForGenkit[historyForGenkit.length - 1] 
        : null;

    if (!lastUserMessage) {
        const errorMsg = "A valid user message is required to start the chat.";
        console.error(`Error in handleChat: ${errorMsg}. Sanitized History:`, historyForGenkit);
        return { response: '', error: errorMsg };
    }

    // Handle file context if present, adding it to the last user message.
    if (file) {
      let contextText = "";
      try {
        if (file.type.startsWith("image/")) {
          const photoDataUri = await fileToDataUri(file);
          const description = await decodeImage({ photoDataUri, model });
          contextText = `Contexte de l'image jointe: ${description.description}.`;
        } else { 
          const documentContent = await extractTextFromFile(file);
           if (!documentContent.trim()) {
              return { response: '', error: `Le fichier ${file.name} est vide ou illisible.` };
          }
          const summary = await summarizeDocument({ documentContent, format: "text", model });
          contextText = `Contexte du document (${file.name}): ${summary.summary}.`;
        }
      } catch (error: any) {
         console.error("Error processing file:", error);
         return { response: '', error: `Erreur lors du traitement du fichier: ${error.message}` };
      }

      // Inject context into the LAST user message.
      lastUserMessage.content = lastUserMessage.content
        ? `${contextText}\n\nMessage de l'utilisateur: ${lastUserMessage.content}`.trim()
        : contextText;
    }
    
    // FINAL SAFEGUARD before calling the AI
    if (historyForGenkit.length === 0) {
      const errorMsg = "Cannot process a request with no valid messages after sanitization.";
      console.error(`Error in handleChat: ${errorMsg}. Original history had ${history.length} items.`);
      return { response: '', error: errorMsg };
    }
    
    // Call the AI flow with clean, validated data
    const chatResult = await multilingualChat({ 
      messages: historyForGenkit,
      persona: cocotalkContext?.persona,
      rules: cocotalkContext?.instructions,
      model: model,
    });
    
    return { response: chatResult.response, error: null };

  } catch (error: any) {
      console.error("Error in handleChat:", error);
      return { response: '', error: error.message || "Une erreur inconnue est survenue dans le chat." };
  }
}
