
'use server';

/**
 * @fileOverview A multilingual chat AI agent that detects the language of the user's input and responds in the same language.
 *
 * - multilingualChat - A function that handles the multilingual chat process.
 * - MultilingualChatInput - The input type for the multilingualChat function.
 * - MultilingualChatOutput - The return type for the multilingualChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { searchWebTool } from '../tools/web-search';
import type { Message } from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const MultilingualChatInputSchema = z.object({
  message: z.string().describe('The latest user message.'),
  history: z.array(MessageSchema).optional().describe('The history of the conversation.'),
  persona: z.string().optional().describe('The persona the assistant should adopt.'),
  customInstructions: z.string().optional().describe('Custom instructions for the assistant.'),
});
export type MultilingualChatInput = z.infer<typeof MultilingualChatInputSchema>;

const MultilingualChatOutputSchema = z.object({
  response: z.string().describe('The chatbot response in the same language as the user message.'),
});
export type MultilingualChatOutput = z.infer<typeof MultilingualChatOutputSchema>;

export async function multilingualChat(input: MultilingualChatInput): Promise<MultilingualChatOutput> {
  return multilingualChatFlow(input);
}

const multilingualChatPrompt = ai.definePrompt({
  name: 'multilingualChatPrompt',
  input: {schema: MultilingualChatInputSchema},
  output: {schema: MultilingualChatOutputSchema},
  tools: [searchWebTool],
  system: `{{#if customInstructions}}
{{{customInstructions}}}
{{#if persona}}

Persona context:
{{{persona}}}
{{/if}}
{{else}}
You are a multilingual chatbot that can understand and respond in any language.
The user will send you a message, and you must respond in the same language as the message.
{{/if}}`,
  prompt: `{{{message}}}`,
});

const multilingualChatFlow = ai.defineFlow(
  {
    name: 'multilingualChatFlow',
    inputSchema: MultilingualChatInputSchema,
    outputSchema: MultilingualChatOutputSchema,
  },
  async (input) => {
    const history: Message[] =
      input.history?.map((h) => ({
        role: h.role,
        content: [{text: h.content}],
      })) || [];

    const {output} = await multilingualChatPrompt(input, {history});
    return output!;
  }
);
