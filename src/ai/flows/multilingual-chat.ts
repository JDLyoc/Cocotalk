
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

// Input uses 'user' and 'model' roles, which is what Genkit expects.
const MessageSchema = z.object({
  role: z.enum(['user', 'model', 'tool']),
  content: z.string(),
});

// The input for the generic chat flow.
const MultilingualChatInputSchema = z.object({
  messages: z.array(MessageSchema).describe('The entire conversation history, from oldest to newest.'),
  persona: z.string().optional().describe('The persona the assistant should adopt.'),
  rules: z.string().optional().describe('The user-defined scenario, rules, and instructions the agent must follow.'),
  model: z.string().optional().describe('The specific AI model to use for the generation.'),
});
export type MultilingualChatInput = z.infer<typeof MultilingualChatInputSchema>;

// The output is just the agent's response.
const MultilingualChatOutputSchema = z.object({
  response: z.string().describe('The chatbot response in the same language as the user message.'),
});
export type MultilingualChatOutput = z.infer<typeof MultilingualChatOutputSchema>;

/**
 * Creates a system prompt based on persona and rules
 * @param persona - The persona to adopt
 * @param rules - The rules and scenario to follow
 * @returns Formatted system prompt
 */
function createSystemPrompt(persona?: string, rules?: string): string {
  const defaultPersona = 'You are a helpful, knowledgeable, and friendly AI assistant.';
  const defaultRules = 'Provide helpful, accurate, and contextually appropriate responses. Always respond in the same language as the user\'s message.';

  return `You are a powerful and flexible conversational AI assistant.
Your behavior is defined by the following persona and rules. You MUST follow them carefully.

## Persona
${persona || defaultPersona}

## Rules & Scenario
${rules || defaultRules}

## Important Guidelines
- Always respond in the same language as the user's last message
- Maintain consistency with your defined persona throughout the conversation
- If you need recent information or facts, use the web search tool
- Be helpful, accurate, and contextually aware
- Follow the conversation flow naturally

## Available Tools
You have access to a web search tool. Use it by calling 'searchWeb' when you need:
- Recent information or current events
- Up-to-date facts or data
- News or trending topics
- Information that might have changed recently
`;
}

// The exported function that the application will call.
export async function multilingualChat(input: MultilingualChatInput): Promise<MultilingualChatOutput> {
  return multilingualChatFlow(input);
}

// The main flow with improved error handling and validation
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
      
      // History is assumed to be pre-sanitized by actions.ts
      let historyForGenkit = messages as Message[];

      // Inject system instructions for Cocotalks (custom assistants)
      if (persona || rules) {
        const systemPrompt = createSystemPrompt(persona, rules);
        
        // Find the first user message and prepend the system prompt
        const firstUserMessageIndex = historyForGenkit.findIndex(msg => msg.role === 'user');
        if (firstUserMessageIndex !== -1) {
          const originalContent = historyForGenkit[firstUserMessageIndex].content;
          historyForGenkit[firstUserMessageIndex].content = `${systemPrompt}\n\n---\n\nUser Request:\n${originalContent}`;
        }
      }

      // Final validation before calling AI
      if (!Array.isArray(historyForGenkit) || historyForGenkit.length === 0) {
        throw new Error('History is empty after all processing');
      }

      // Start the generation process
      let genkitResponse;
      try {
        genkitResponse = await ai.generate({
          model: activeModel,
          history: historyForGenkit,
          tools: [searchWebTool],
          toolChoice: 'auto',
          config: {
            temperature: 0.7,
            maxOutputTokens: 4000,
          }
        });
      } catch (error: any) {
        console.error(`Generation attempt failed:`, error.message);
        throw new Error(`Failed to generate response: ${error.message}`);
      }

      // Handle tool calls in a loop with safety limits
      let toolCallCount = 0;
      const maxToolCalls = 5;

      while (toolCallCount < maxToolCalls) {
        // If the response contains text, we're done
        if (genkitResponse.text?.trim()) {
          break;
        }

        const toolCalls = genkitResponse.toolCalls();
        if (toolCalls && toolCalls.length > 0) {
          const toolOutputs: Message[] = [];
          
          for (const call of toolCalls) {
            try {
              const output = await ai.runTool(call);
              toolOutputs.push(output as Message);
            } catch (toolError: any) {
              console.error('Tool execution failed:', toolError.message);
              toolOutputs.push({
                role: 'tool',
                content: `Tool execution failed: ${toolError.message}`
              });
            }
          }
          
          const newHistory = [...historyForGenkit, genkitResponse.message, ...toolOutputs];
          
          try {
            genkitResponse = await ai.generate({
              model: activeModel,
              history: newHistory,
              tools: [searchWebTool],
              toolChoice: 'auto',
              config: {
                temperature: 0.7,
                maxOutputTokens: 4000,
              }
            });
            toolCallCount++;
          } catch (regenError: any) {
            console.error('Regeneration after tool call failed:', regenError.message);
            // Break loop on regen error to avoid infinite loops
            genkitResponse = { ...genkitResponse, text: "J'ai rencontré un problème en essayant d'utiliser mes outils. Veuillez réessayer." };
            break;
          }
        } else {
          // No text and no tool calls - abnormal state, break loop
          break;
        }
      }

      // Extract the final text response
      const finalText = genkitResponse?.text?.trim() || '';
      
      if (!finalText) {
        console.warn('No text response generated, using fallback');
        return { 
          response: 'Je suis désolé, je n\'ai pas pu générer une réponse appropriée. Pouvez-vous reformuler votre demande ?' 
        };
      }
      
      return { response: finalText };

    } catch (error: any) {
      console.error('Critical error in multilingualChatFlow:', error);
      
      const fallbackMessage = error.message?.includes('quota') || error.message?.includes('rate limit')
        ? 'Le service est temporairement surchargé. Veuillez réessayer dans quelques instants.'
        : `Une erreur technique s'est produite: ${error.message}`;
      
      return { response: fallbackMessage };
    }
  }
);
