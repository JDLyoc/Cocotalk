
'use server';

/**
 * @fileOverview A generic, instruction-driven, multilingual chat AI agent.
 * This agent can adopt any persona and follow any conversational scenario
 * defined in the user-provided instructions. It can also use tools like web search.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
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
      
      // Guard against empty input, this is critical.
      if (!messages || messages.length === 0) {
        return { error: "INVALID_ARGUMENT: Conversation history cannot be empty." };
      }
      
      // Build the history for the AI in a robust way.
      const historyForAI: Message[] = [];
      
      // Step 1: Add system instructions via a few-shot prompt if it's a Cocotalk.
      if (rules) {
        const fullPersona = persona || 'You are a helpful, knowledgeable, and friendly AI assistant.';
        const systemPrompt = `You are a powerful and flexible conversational AI assistant.
Your behavior is defined by the following persona and rules. You MUST follow them carefully.

## Persona
${fullPersona}

## Rules & Scenario
${rules}`;
        
        historyForAI.push({ role: 'user', content: [{ text: systemPrompt }] });
        historyForAI.push({ role: 'model', content: [{ text: "Yes, I understand. I will follow these instructions." }] });
      }
      
      // Step 2: Add the actual conversation history.
      messages.forEach(msg => {
        historyForAI.push({
          role: msg.role as 'user' | 'model' | 'tool',
          content: [{ text: msg.content }]
        });
      });

      const genkitResponse = await ai.generate({
        model: activeModel,
        history: historyForAI,
        tools: [searchWebTool],
        toolChoice: 'auto',
        config: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        }
      });
      
      const toolCalls = genkitResponse.toolCalls;
      if (toolCalls && toolCalls.length > 0) {
        const toolOutputs = await Promise.all(toolCalls.map(ai.runTool));
        const finalResponse = await ai.generate({
          model: activeModel,
          history: [...historyForAI, genkitResponse.message, ...toolOutputs],
          tools: [searchWebTool],
        });
        return { response: finalResponse.text };
      }
      
      const responseText = genkitResponse.text;
      if (!responseText) {
          return { response: "Sorry, I couldn't generate a response." };
      }

      return { response: responseText };

    } catch (error: any)
    {
      console.error('Critical error in multilingualChatFlow:', error);
      
      let errorMessage = `An error occurred: ${error.message}`;
      if (error.message?.includes('API key not valid')) {
        errorMessage = `The Google API key is invalid. Please check the GOOGLE_API_KEY variable in your .env file.`;
      } else if (error.message?.includes('permission') || error.message?.includes('denied')) {
        errorMessage = `Permission error. Likely causes:
1. API Key Restrictions: In Google Cloud Console > APIs & Services > Credentials > [Your API Key], ensure "Application restrictions" is "None" AND "API restrictions" is "Don't restrict key".
2. API Not Enabled: Ensure the "Gemini API" is enabled for this project.
3. Billing Not Linked: Ensure billing is enabled and linked to this project.
4. Wrong Project: Ensure the project at the top of the Google Cloud Console is the correct one.`;
      } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        errorMessage = 'The service is temporarily overloaded. Please try again in a moment.';
      } else if (error.message?.includes('Schema validation failed')) {
        errorMessage = `A data validation error occurred, indicating a mismatch between the data sent and the format expected by the AI. Details: ${error.message}`;
      }

      return { error: errorMessage };
    }
  }
);
