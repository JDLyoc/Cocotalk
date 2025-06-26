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

/**
 * Validates and cleans the message history to ensure it's in a valid format for the Genkit API.
 * This function is critical for stability. It ensures:
 * 1. Only valid messages with content are kept.
 * 2. The history starts with a 'user' message.
 * 3. Roles alternate correctly (no two consecutive 'user' or 'model' roles).
 */
function validateAndCleanHistory(messages: Message[]): Message[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  // 1. Filter out any messages that are fundamentally invalid (no role/content)
  const validFormatMessages = messages.filter(
    (msg) =>
      msg &&
      msg.role &&
      ['user', 'model', 'tool'].includes(msg.role) &&
      typeof msg.content === 'string' &&
      msg.content.trim().length > 0
  );

  if (validFormatMessages.length === 0) {
    return [];
  }
  
  // 2. Ensure we start with a user message if possible
  const firstUserIndex = validFormatMessages.findIndex((msg) => msg.role === 'user');
  if (firstUserIndex === -1) {
    return []; // No user message, invalid history
  }
  const historyStartingWithUser = validFormatMessages.slice(firstUserIndex);


  // 3. Remove consecutive duplicate roles (e.g., user, user -> user)
  const cleanedHistory: Message[] = [];
  historyStartingWithUser.forEach((message) => {
    if (cleanedHistory.length === 0 || cleanedHistory[cleanedHistory.length - 1].role !== message.role) {
      cleanedHistory.push(message);
    } else {
        // If the role is the same, overwrite the last message with the new one.
        // This handles cases where UI state might have caused duplicates.
        cleanedHistory[cleanedHistory.length - 1] = message;
    }
  });

  return cleanedHistory;
}


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
      
      // Step 1: Validate and clean the history. This is the crucial step.
      let historyForGenkit = validateAndCleanHistory(messages || []);

      // CRITICAL FIX: If history is invalid or empty after cleaning, stop immediately.
      if (historyForGenkit.length === 0) {
        console.error("No valid messages found after cleaning. Original message count:", messages?.length);
        return { error: "Aucun message valide à envoyer. Veuillez vérifier votre saisie." };
      }

      // Step 2: Inject system instructions for Cocotalks (if applicable)
      if (persona || rules) {
        const systemPrompt = createSystemPrompt(persona, rules);
        const firstUserMessage = historyForGenkit[0];
        // Prepend the system prompt to the first user message.
        firstUserMessage.content = `${systemPrompt}\n\n---\n\nUser Request:\n${firstUserMessage.content}`;
      }

      // Step 3: Call the AI with the prepared history
      const genkitResponse = await ai.generate({
        model: activeModel,
        history: historyForGenkit,
        tools: [searchWebTool],
        toolChoice: 'auto',
        config: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        }
      });
      
      // Step 4: Handle potential tool calls
      const toolCalls = genkitResponse.toolCalls();
      if (toolCalls && toolCalls.length > 0) {
        const toolOutputs = await Promise.all(toolCalls.map(ai.runTool));
        const finalResponse = await ai.generate({
          model: activeModel,
          history: [...historyForGenkit, genkitResponse.message, ...toolOutputs],
          tools: [searchWebTool],
        });
        return { response: finalResponse.text() };
      }
      
      const responseText = genkitResponse.text();
      if (!responseText) {
          return { response: "Désolé, je n'ai pas pu générer une réponse." };
      }

      return { response: responseText };

    } catch (error: any) {
      console.error('Critical error in multilingualChatFlow:', error);
      const errorMessage = error.message?.includes('quota') || error.message?.includes('rate limit')
        ? 'Le service est temporairement surchargé. Veuillez réessayer dans quelques instants.'
        : `Une erreur est survenue: ${error.message}`;
      return { error: errorMessage };
    }
  }
);