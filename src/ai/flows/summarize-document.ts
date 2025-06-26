// src/ai/flows/summarize-document.ts
'use server';

/**
 * @fileOverview A document summarization AI agent.
 *
 * - summarizeDocument - A function that handles the document summarization process.
 * - SummarizeDocumentInput - The input type for the summarizeDocument function.
 * - SummarizeDocumentOutput - The return type for the summarizeDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeDocumentInputSchema = z.object({
  documentContent: z
    .string()
    .describe('The content of the document to summarize.'),
  format: z
    .enum(['text', 'markdown'])
    .default('text')
    .describe('The format of the summary.'),
  model: z.string().optional().describe('The specific AI model to use for the generation.'),
});
export type SummarizeDocumentInput = z.infer<typeof SummarizeDocumentInputSchema>;

const SummarizeDocumentOutputSchema = z.object({
  summary: z.string().describe('The summary of the document.'),
});
export type SummarizeDocumentOutput = z.infer<typeof SummarizeDocumentOutputSchema>;

export async function summarizeDocument(input: SummarizeDocumentInput): Promise<SummarizeDocumentOutput> {
  return summarizeDocumentFlow(input);
}

const summarizeDocumentFlow = ai.defineFlow(
  {
    name: 'summarizeDocumentFlow',
    inputSchema: SummarizeDocumentInputSchema,
    outputSchema: SummarizeDocumentOutputSchema,
  },
  async (input) => {
    const activeModel = input.model || 'googleai/gemini-2.0-flash';
    const prompt = `You are an expert at summarizing documents. Please provide a concise summary of the following document. The summary should be in ${input.format} format.\n\nDocument Content:\n${input.documentContent}`;
    
    const { output } = await ai.generate({
        model: activeModel,
        prompt: prompt,
        output: { schema: SummarizeDocumentOutputSchema },
    });
    return output!;
  }
);
