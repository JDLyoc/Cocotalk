
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
  history: z.array(MessageSchema).describe('The conversation history, excluding the last message.'),
  lastMessage: MessageSchema.describe('The last message from the user to be processed.'),
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

const PromptInputSchema = z.object({
  lastMessage: MessageSchema,
  persona: z.string().optional(),
  customInstructions: z.string().optional(),
});

const multilingualChatPrompt = ai.definePrompt({
  name: 'multilingualChatPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: MultilingualChatOutputSchema },
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
  prompt: `{{{lastMessage.content}}}`,
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

    const promptInput = {
        lastMessage: input.lastMessage,
        persona: input.persona,
        customInstructions: input.customInstructions
    };
    
    const {output} = await multilingualChatPrompt(promptInput, { history });
    return output!;
  }
);
