
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
    
    // To work around the "system role not supported" error, we manually inject
    // the instructions into the content of the very first user message.
    const systemInstruction = "You are a helpful and friendly assistant. Always respond in French, regardless of the user's language.";
    
    // A valid conversation must start with a user message.
    if (historyForAI.length > 0 && historyForAI[0].role === 'user') {
      const firstUserMessage = historyForAI[0];
      const originalContent = (firstUserMessage.content[0] as { text: string }).text;
      
      // Prepend the instruction to the original content. This happens on every call,
      // but since the history is rebuilt from clean Firestore data each time, it's safe.
      (firstUserMessage.content[0] as { text: string }).text = `${systemInstruction}\n\n---\n\n${originalContent}`;
    }

    try {
      const genkitResponse = await ai.generate({
        model: activeModel,
        history: historyForAI, // Pass the modified history
        config: {
          temperature: 0.7,
        },
      });

      const responseText = genkitResponse.text;
      if (!responseText) {
        return { response: "Désolé, je n'ai pas pu générer de réponse." };
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
