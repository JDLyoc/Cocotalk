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
 * A simple and robust history validation function.
 * It ensures the history is an array of valid messages and starts with a 'user' role.
 * This prevents the 'at least one message is required' error for new conversations.
 */
function validateAndCleanHistory(messages: Message[] | undefined | null): Message[] {
    if (!Array.isArray(messages) || messages.length === 0) {
        return [];
    }

    // Filter for valid, non-empty messages
    const validMessages = messages.filter(
        (msg) => msg && msg.role && typeof msg.content === 'string' && msg.content.trim().length > 0
    );

    if (validMessages.length === 0) {
        return [];
    }
    
    // The history must start with a user message for the API.
    if (validMessages[0].role !== 'user') {
        const firstUserIndex = validMessages.findIndex(m => m.role === 'user');
        if (firstUserIndex === -1) {
            return []; // No user messages at all.
        }
        return validMessages.slice(firstUserIndex);
    }

    return validMessages;
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
      
      // Step 1: Validate and clean the history using the new robust function.
      let historyForGenkit = validateAndCleanHistory(messages);

      // CRITICAL: If history is invalid or empty after cleaning, stop immediately.
      if (historyForGenkit.length === 0) {
        const errorMessage = "No valid messages to send. Please check your input.";
        console.error(errorMessage, "Original message count:", messages?.length);
        return { error: errorMessage };
      }

      // Step 2: Inject system instructions if applicable
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
