
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

// Unification des rôles en 'user' et 'model'
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

// The output is now just the agent's response.
const MultilingualChatOutputSchema = z.object({
  response: z.string().describe('The chatbot response in the same language as the user message.'),
});
export type MultilingualChatOutput = z.infer<typeof MultilingualChatOutputSchema>;

/**
 * Validates and ensures the message history is proper for Genkit
 * @param messages - Array of messages to validate
 * @returns Validated and cleaned message array
 */
function validateAndCleanHistory(messages: Message[]): Message[] {
  // Filter out invalid messages
  const validMessages = messages.filter(msg => 
    msg && 
    typeof msg === 'object' &&
    msg.role &&
    ['user', 'model', 'tool'].includes(msg.role) &&
    msg.content &&
    typeof msg.content === 'string' &&
    msg.content.trim().length > 0
  );

  if (validMessages.length === 0) {
    console.warn('No valid messages found in history');
    return [];
  }

  // Ensure alternating roles and no duplicates
  const cleanedHistory: Message[] = [];
  let lastRole: string | null = null;

  for (const message of validMessages) {
    // Skip consecutive messages with the same role (except for tool messages)
    if (message.role === lastRole && message.role !== 'tool') {
      continue;
    }
    
    cleanedHistory.push({
      role: message.role as 'user' | 'model' | 'tool',
      content: message.content.trim()
    });
    
    lastRole = message.role;
  }

  // Ensure we start with a user message
  const firstUserIndex = cleanedHistory.findIndex(msg => msg.role === 'user');
  if (firstUserIndex === -1) {
    console.warn('No user message found in history');
    return [];
  }

  // No mapping needed as roles are now unified for Genkit
  return cleanedHistory.slice(firstUserIndex);
}

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
      
      console.log(`Starting chat flow with ${messages.length} messages, model: ${activeModel}`);
      
      // Validate and clean the input messages
      let historyForGenkit = validateAndCleanHistory(messages as Message[]);
      
      // Critical check: ensure we have at least one message
      if (!historyForGenkit || historyForGenkit.length === 0) {
        console.error('CRITICAL: No valid messages found after validation');
        
        // Create a fallback message if no valid history exists
        historyForGenkit = [{
          role: 'user',
          content: 'Hello, how can you help me today?'
        }];
        
        console.log('Created fallback message for empty history');
      }

      // Inject system instructions for Cocotalks (custom assistants)
      if (persona || rules) {
        const systemPrompt = createSystemPrompt(persona, rules);
        
        // Find the first user message and prepend the system prompt
        const firstUserMessageIndex = historyForGenkit.findIndex(msg => msg.role === 'user');
        if (firstUserMessageIndex !== -1) {
          const originalContent = historyForGenkit[firstUserMessage-index].content;
          historyForGenkit[firstUserMessageIndex].content = `${systemPrompt}\n\n---\n\nUser Request:\n${originalContent}`;
          
          console.log('Injected system prompt into first user message');
        }
      }

      // Final validation before calling AI
      if (!Array.isArray(historyForGenkit) || historyForGenkit.length === 0) {
        throw new Error('History is still empty after all validation attempts');
      }

      console.log(`Processed history contains ${historyForGenkit.length} messages`);

      // Start the generation process with retry logic
      let genkitResponse;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
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
          break; // Success, exit retry loop
        } catch (error: any) {
          retryCount++;
          console.error(`Generation attempt ${retryCount} failed:`, error.message);
          
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to generate response after ${maxRetries} attempts: ${error.message}`);
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (!genkitResponse) {
        throw new Error('Failed to get response from AI model');
      }

      // Handle tool calls in a loop with safety limits
      let toolCallCount = 0;
      const maxToolCalls = 5;

      while (toolCallCount < maxToolCalls) {
        // If the response contains text, we're done
        if (genkitResponse.text && genkitResponse.text.trim()) {
          console.log('Generated final text response');
          break;
        }

        const toolCalls = genkitResponse.toolCalls();
        if (toolCalls && toolCalls.length > 0) {
          console.log(`Processing ${toolCalls.length} tool calls (attempt ${toolCallCount + 1})`);
          
          const toolOutputs: any[] = [];
          
          // Execute each requested tool with error handling
          for (const call of toolCalls) {
            try {
              console.log('Executing tool call:', call.name);
              const output = await ai.runTool(call);
              toolOutputs.push(output);
            } catch (toolError: any) {
              console.error('Tool execution failed:', toolError.message);
              // Continue with other tools even if one fails
              toolOutputs.push({
                role: 'tool',
                content: `Tool execution failed: ${toolError.message}`
              });
            }
          }
          
          // Re-run generation with the tool results
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
            break;
          }
        } else {
          // No text and no tool calls - abnormal state
          console.warn('Response has no text and no tool calls, breaking loop');
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

      console.log(`Successfully generated response of ${finalText.length} characters`);
      return { response: finalText };

    } catch (error: any) {
      console.error('Critical error in multilingualChatFlow:', error);
      
      // Return a user-friendly error message
      const fallbackMessage = error.message?.includes('quota') || error.message?.includes('rate limit')
        ? 'Le service est temporairement surchargé. Veuillez réessayer dans quelques instants.'
        : 'Une erreur technique s\'est produite. Veuillez réessayer votre demande.';
      
      return { response: fallbackMessage };
    }
  }
);
