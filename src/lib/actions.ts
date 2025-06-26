
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
  history: StoredMessage[], 
  file: File | null,
  agentContext: AgentContext,
  model: string
) {
  try {
    // Step 1: Translate roles for Genkit ('assistant' -> 'model') and robustly clean data.
    let genkitHistory: GenkitMessage[] = history
        .filter(msg => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string' && msg.content.trim() !== '')
        .map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            content: msg.content,
        }));

    // Step 2: Handle file context if present.
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
      const lastUserMessageIndex = genkitHistory.map(m => m.role).lastIndexOf('user');
      if (lastUserMessageIndex !== -1) {
          // If there's text with the file, combine them.
          if(genkitHistory[lastUserMessageIndex].content) {
            genkitHistory[lastUserMessageIndex].content = `${contextText}\n\nMessage de l'utilisateur: ${genkitHistory[lastUserMessageIndex].content}`.trim();
          } else {
            // If there's only a file, the context is the message.
            genkitHistory[lastUserMessageIndex].content = contextText;
          }
      } else {
          // If no user message exists (e.g., file sent alone in a new chat), create one.
          genkitHistory.push({ role: 'user', content: contextText });
      }
    }
    
    // Final safety check to prevent sending an empty request.
    if (genkitHistory.length === 0) {
        console.error("handleChat determined history is empty before calling AI flow.");
        return { response: '', error: "Impossible d'envoyer une requête vide." };
    }
    
    // Step 3: Call the AI flow with clean, validated data
    const chatResult = await multilingualChat({ 
      messages: genkitHistory,
      persona: agentContext?.persona,
      rules: agentContext?.rules,
      model: model,
    });
    
    return { response: chatResult.response, error: null };

  } catch (error: any) {
      console.error("Error in handleChat:", error);
      return { response: '', error: error.message || "Une erreur inconnue est survenue dans le chat." };
  }
}
