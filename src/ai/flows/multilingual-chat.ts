
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
  messages: z.array(MessageSchema).describe('The entire conversation history, including the last message.'),
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
    persona: z.string().optional(),
    customInstructions: z.string().optional(),
    lastUserMessage: z.string(),
});

const multilingualChatPrompt = ai.definePrompt({
  name: 'multilingualChatPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: MultilingualChatOutputSchema },
  tools: [searchWebTool],
  system: `{{#if customInstructions}}
You are a helpful assistant that follows a script.
Your instructions are a script for a conversation.
The entire conversation history is provided.
Your task is to figure out which step of the script you are on, and then provide the message for the NEXT step.
If the user has just answered a question from the script, proceed to the next step. Do not repeat the question.

Your script is:
---
{{{customInstructions}}}
---

{{#if persona}}
Your persona is:
---
{{{persona}}}
---
{{/if}}

{{else}}
You are a multilingual chatbot that can understand and respond in any language.
The user will send you a message, and you must respond in the same language as the message.
{{/if}}`,
  prompt: `{{{lastUserMessage}}}`,
});

const multilingualChatFlow = ai.defineFlow(
  {
    name: 'multilingualChatFlow',
    inputSchema: MultilingualChatInputSchema,
    outputSchema: MultilingualChatOutputSchema,
  },
  async (input) => {
    const allMessages = input.messages || [];

    if (allMessages.length === 0) {
      throw new Error("Cannot process an empty conversation.");
    }
    
    const lastMessage = allMessages[allMessages.length - 1];
    const historyMessages = allMessages.slice(0, -1);

    const history: Message[] = historyMessages.map((h) => ({
      role: h.role,
      content: [{text: h.content}],
    }));

    const promptInput = {
        persona: input.persona,
        customInstructions: input.customInstructions,
        lastUserMessage: lastMessage.content,
    };
    
    const {output} = await multilingualChatPrompt(promptInput, { history });
    return output!;
  }
);
