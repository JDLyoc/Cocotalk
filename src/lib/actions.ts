
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
import type { Message } from "@/app/page";

async function fileToDataUri(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

async function fileToText(file: File): Promise<string> {
    return file.text();
}

export async function handleChat(
  history: Message[],
  text: string,
  file: File | null
) {
  let contextText = "";

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
    } else if (file.type === "text/plain") {
      try {
        const documentContent = await fileToText(file);
        const summary = await summarizeDocument({ documentContent, format: "text" });
        contextText = `Contexte du document joint: ${summary.summary}.`;
      } catch (error) {
        console.error("Error summarizing document:", error);
        return { error: "Erreur lors du résumé du document." };
      }
    } else {
      return { error: `Type de fichier non supporté: ${file.type}. Seuls les images et les fichiers texte sont acceptés.` };
    }
  }

  const fullMessage = contextText ? `${contextText} Message de l'utilisateur: ${text}` : text;
  
  // For now, we are not using history but this can be enhanced to use it
  const response = await multilingualChat({ message: fullMessage });

  return { response: response.response };
}
