'use server';

/**
 * @fileOverview A generic, instruction-driven, multilingual chat AI agent.
 * This agent can adopt any persona and follow any conversational scenario
 * defined in the user-provided instructions. It can also use tools like web search.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Message } from 'genkit';
import { searchWebTool } from '@/ai/tools/web-search';

const MessageSchema = z.object({
  role: z.enum(['user', 'model', 'tool']),
  content: z.string(),
});

const MultilingualChatInputSchema = z.object({
  messages: z.array(MessageSchema).describe('The entire conversation history, from oldest to newest.'),
  persona: z.string().optional().describe('The persona the assistant should adopt.'),
  rules: z.string().optional().describe('The user-defined scenario, rules, and instructions the agent must follow.'),
  model: z.string().optional().describe('The specific AI model to use for the generation.'),
});
export type MultilingualChatInput = z.infer<typeof MultilingualChatInputSchema>;

const MultilingualChatOutputSchema = z.object({
  response: z.string().optional().describe('The chatbot response in the same language as the user message.'),
  error: z.string().optional().describe('An error message if the process failed.'),
});
export type MultilingualChatOutput = z.infer<typeof MultilingualChatOutputSchema>;


function createSystemPrompt(persona?: string, rules?: string): string {
  const defaultPersona = 'You are a helpful, knowledgeable, and friendly AI assistant.';
  const defaultRules = 'Provide helpful, accurate, and contextually appropriate responses. Always respond in the same language as the user\'s message.';

  return `You are a powerful and flexible conversational AI assistant.
Your behavior is defined by the following persona and rules. You MUST follow them carefully.

## Persona
${persona || defaultPersona}

## Rules & Scenario
${rules || defaultRules}
`;
}


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
    try {
      const { messages, persona, rules, model } = input;
      const activeModel = model || 'googleai/gemini-2.0-flash';
      
      if (!messages || messages.length === 0) {
        return { error: "INVALID_ARGUMENT: Au moins un message est requis pour démarrer une conversation." };
      }

      const systemPrompt = (persona || rules) ? createSystemPrompt(persona, rules) : undefined;
      
      // Convert the simple string-based messages to the structure Genkit expects.
      const genkitMessages: Message[] = messages.map(msg => ({
          role: msg.role as 'user' | 'model' | 'tool',
          content: [{ text: msg.content }]
      }));
      
      // The history is all messages EXCEPT the last one.
      const historyForGenkit: Message[] = genkitMessages.slice(0, -1);
      // The prompt is the content of the very last message.
      const lastMessage = genkitMessages[genkitMessages.length - 1];
      const promptForGenkit = lastMessage.content;

      // Call the AI with the prepared history and system prompt
      const genkitResponse = await ai.generate({
        model: activeModel,
        system: systemPrompt,
        prompt: promptForGenkit,
        history: historyForGenkit,
        tools: [searchWebTool],
        toolChoice: 'auto',
        config: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        }
      });
      
      // Handle potential tool calls
      const toolCalls = genkitResponse.toolCalls;
      if (toolCalls && toolCalls.length > 0) {
        const toolOutputs = await Promise.all(toolCalls.map(ai.runTool));
        const finalResponse = await ai.generate({
          model: activeModel,
          system: systemPrompt,
          // The new history includes the original messages, the model's tool request, and the tool's response
          history: [...genkitMessages, genkitResponse.message, ...toolOutputs],
          tools: [searchWebTool],
        });
        return { response: finalResponse.text };
      }
      
      const responseText = genkitResponse.text;
      if (!responseText) {
          return { response: "Désolé, je n'ai pas pu générer une réponse." };
      }

      return { response: responseText };

    } catch (error: any)
    {
      console.error('Critical error in multilingualChatFlow:', error);
      
      let errorMessage = `Une erreur est survenue: ${error.message}`;
      if (error.message?.includes('INVALID_ARGUMENT')) {
        errorMessage = `Un argument invalide a été envoyé à l'IA. Détails: ${error.message}`;
      } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        errorMessage = 'Le service est temporairement surchargé. Veuillez réessayer dans quelques instants.';
      }

      return { error: errorMessage };
    }
  }
);
