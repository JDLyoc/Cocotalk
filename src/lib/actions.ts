
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
import type { Message as GenkitMessage } from "genkit";
import type { StoredMessage } from "@/app/page";


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

interface AgentContext {
    persona?: string;
    rules?: string;
}

export async function handleChat(
  history: StoredMessage[], // History from client with 'assistant' role
  file: File | null,
  agentContext: AgentContext,
  model: string
) {
  try {
    // Step 1: Translate roles for Genkit ('assistant' -> 'model')
    const genkitHistory: GenkitMessage[] = history
        .filter(msg => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
        .map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            content: msg.content,
        }));

    let contextText = "";
    const lastUserMessage = genkitHistory.length > 0 ? genkitHistory[genkitHistory.length - 1] : null;

    // Step 2: Handle file context if present
    if (file) {
      if (file.type.startsWith("image/")) {
        try {
          const photoDataUri = await fileToDataUri(file);
          const description = await decodeImage({ photoDataUri, model });
          contextText = `Contexte de l'image jointe: ${description.description}.`;
        } catch (error) {
          console.error("Error decoding image:", error);
          return { response: '', error: "Erreur lors de l'analyse de l'image." };
        }
      } else { 
        try {
          const documentContent = await extractTextFromFile(file);
          if (!documentContent.trim()) {
              return { response: '', error: `Le fichier ${file.name} est vide ou illisible.` };
          }
          const summary = await summarizeDocument({ documentContent, format: "text", model });
          contextText = `Contexte du document (${file.name}): ${summary.summary}.`;
        } catch (error: any) {
          console.error("Error processing document:", error);
          return { response: '', error: `Erreur lors du traitement du fichier: ${error.message}` };
        }
      }
    }

    // Step 3: Inject file context into the last user message
    if (contextText && lastUserMessage && lastUserMessage.role === 'user') {
      lastUserMessage.content = `${contextText}\n\nMessage de l'utilisateur: ${lastUserMessage.content}`;
    }
    
    if (genkitHistory.length === 0) {
        return { response: '', error: "Impossible d'envoyer une conversation vide." };
    }
    
    // Step 4: Call the AI flow with clean, translated data
    const chatResult = await multilingualChat({ 
      messages: genkitHistory,
      persona: agentContext?.persona,
      rules: agentContext?.rules,
      model: model,
    });
    
    const responseText = chatResult?.response ?? '';
    return { response: responseText, error: null };

  } catch (error: any) {
      console.error("Error in handleChat:", error);
      return { response: '', error: error.message || "Une erreur inconnue est survenue dans le chat." };
  }
}
