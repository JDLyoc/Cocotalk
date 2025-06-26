
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
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

interface CustomContext {
    instructions: string;
    persona?: string;
}

export async function handleChat(
  history: StoredMessage[],
  file: File | null,
  customContext?: CustomContext
) {
  let contextText = "";
  const conversationHistory = [...history]; // Create a mutable copy

  if (file) {
    if (file.type.startsWith("image/")) {
      try {
        const photoDataUri = await fileToDataUri(file);
        const description = await decodeImage({ photoDataUri });
        contextText = `Contexte de l'image jointe: ${description.description}.`;
      } catch (error) {
        console.error("Error decoding image:", error);
        return { error: "Erreur lors de l'analyse de l'image." };
      }
    } else { 
      try {
        const documentContent = await extractTextFromFile(file);
        if (!documentContent.trim()) {
            return { error: `Le fichier ${file.name} est vide ou illisible.` };
        }
        const summary = await summarizeDocument({ documentContent, format: "text" });
        contextText = `Contexte du document (${file.name}): ${summary.summary}.`;
      } catch (error: any) {
        console.error("Error processing document:", error);
        return { error: `Erreur lors du traitement du fichier: ${error.message}` };
      }
    }
  }

  // Prepend file context to the last user message if it exists
  if (contextText) {
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
        lastMessage.content = `${contextText}\n\nMessage de l'utilisateur: ${lastMessage.content}`;
    }
  }
  
  const apiMessages = conversationHistory
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content || '',
    }));

  if (apiMessages.length === 0) {
      return { error: "Impossible d'envoyer une conversation vide." };
  }

  const lastMessage = apiMessages.pop()!;
  const apiHistory = apiMessages;

  const response = await multilingualChat({ 
    history: apiHistory,
    lastMessage: lastMessage,
    persona: customContext?.persona,
    customInstructions: customContext?.instructions
  });

  return { response: response.response };
}
