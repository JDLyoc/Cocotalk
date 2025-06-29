
'use server';

/**
 * @fileOverview A simplified, robust, multilingual chat AI agent.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Message } from 'genkit';

// Define the shape of a single message for input validation
const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

// Define the input schema for the entire flow
const MultilingualChatInputSchema = z.object({
  messages: z.array(MessageSchema).describe('The conversation history.'),
  model: z.string().optional().describe('The AI model to use.'),
});
export type MultilingualChatInput = z.infer<typeof MultilingualChatInputSchema>;

// Define the output schema for the flow
const MultilingualChatOutputSchema = z.object({
  response: z.string().optional().describe('The chatbot response.'),
  error: z.string().optional().describe('An error message if the process failed.'),
});
export type MultilingualChatOutput = z.infer<typeof MultilingualChatOutputSchema>;


export async function multilingualChat(input: MultilingualChatInput): Promise<MultilingualChatOutput> {
  return multilingualChatFlow(input);
}


const multilingualChatFlow = ai.defineFlow(
  {
    name: 'multilingualChatFlow',
    inputSchema: MultilingualChatInputSchema,
    outputSchema: MultilingualChatOutputSchema,
  },
  async (input) => {
    // This is our main safeguard. If the messages array is empty, we stop here.
    if (!input.messages || input.messages.length === 0) {
      console.error('Critical error: multilingualChatFlow received an empty messages array.');
      return { error: 'The AI received an empty request. This is a bug in the application.' };
    }

    const activeModel = input.model || 'googleai/gemini-2.0-flash';
    
    // Create a new history array for the AI, in the format Genkit expects.
    const historyForAI: Message[] = input.messages.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }]
    }));

    try {
      const genkitResponse = await ai.generate({
        model: activeModel,
        history: historyForAI,
        config: {
          temperature: 0.7,
        },
      });

      const responseText = genkitResponse.text;
      if (!responseText) {
        return { response: "Sorry, I was unable to generate a response." };
      }

      return { response: responseText };

    } catch (e: any) {
      console.error('Critical error in multilingualChatFlow:', e);
      let errorMessage = `An error occurred: ${e.message}`;
      if (e.message?.includes('API key not valid')) {
        errorMessage = `The Google API key is invalid. Please check the GOOGLE_API_KEY variable in your .env file.`;
      }
      return { error: errorMessage };
    }
  }
);
