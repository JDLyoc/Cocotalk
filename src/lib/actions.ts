
"use server";

import { multilingualChat } from "@/ai/flows/multilingual-chat";
import { decodeImage } from "@/ai/flows/image-decoder";
import { summarizeDocument } from "@/ai/flows/summarize-document";
import type { DisplayMessage } from "@/app/page";

// Using require for CJS modules that may not have full ESM support or types
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
            // A custom pagerender function is used as a workaround for a bug in pdf-parse
            // that can cause file system errors in serverless environments.
            const customPageRender = (pageData: any) => {
                return pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
                .then((textContent: any) => {
                    let lastY: number | undefined;
                    let text = '';
                    for (let item of textContent.items) {
                        if (lastY !== undefined && lastY !== item.transform[5]) {
                            text += '\n';
                        }
                        text += item.str;
                        lastY = item.transform[5];
                    }
                    return text;
                });
            };

            const options = {
                pagerender: customPageRender
            };

            const data = await pdf(buffer, options);
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


export async function handleChat(
  history: DisplayMessage[],
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
    } else { // Handle all supported document types
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

  const fullMessage = contextText ? `${contextText} Message de l'utilisateur: ${text}` : text;
  
  const response = await multilingualChat({ message: fullMessage });

  return { response: response.response };
}
