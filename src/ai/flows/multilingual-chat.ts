'use server';

/**
 * @fileOverview A simplified, robust, multilingual chat AI agent.
 * Fixed for Gemini API compatibility
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { searchWebTool } from '@/ai/tools/web-search';

// Define the shape of a single message for input validation
const MessageSchema = z.object({
  role: z.enum(['user', 'model']), // Only user and model for Gemini
  content: z.string().min(1, 'Message content cannot be empty'),
});

// Define the input schema for the entire flow
const MultilingualChatInputSchema = z.object({
  messages: z.array(MessageSchema).min(1, 'At least one message is required').describe('The conversation history.'),
  model: z.string().optional().describe('The AI model to use.'),
  language: z.string().optional().describe('Preferred response language.'),
});

export type MultilingualChatInput = z.infer<typeof MultilingualChatInputSchema>;

// Define the output schema for the flow
const MultilingualChatOutputSchema = z.object({
  response: z.string().optional().describe('The chatbot response.'),
  error: z.string().optional().describe('An error message if the process failed.'),
  success: z.boolean().describe('Whether the operation was successful.'),
});

export type MultilingualChatOutput = z.infer<typeof MultilingualChatOutputSchema>;

// Main export function
export async function multilingualChat(input: MultilingualChatInput): Promise<MultilingualChatOutput> {
  try {
    // Validate input first
    const validatedInput = MultilingualChatInputSchema.parse(input);
    return await multilingualChatFlow(validatedInput);
  } catch (validationError: any) {
    console.error('❌ Input validation error:', validationError);
    return { 
      error: `Invalid input: ${validationError.message}`, 
      success: false 
    };
  }
}

const multilingualChatFlow = ai.defineFlow(
  {
    name: 'multilingualChatFlow',
    inputSchema: MultilingualChatInputSchema,
    outputSchema: MultilingualChatOutputSchema,
  },
  async (input) => {
    try {
      if (!input.messages || input.messages.length === 0) {
        return { 
          error: 'No messages provided to the AI. Please send at least one message.', 
          success: false 
        };
      }

      const activeModel = input.model || 'googleai/gemini-1.5-flash-latest';
      const preferredLanguage = input.language || 'the same language as the user';
      
      const systemPrompt = `You are a helpful and conversational assistant. Respond in ${preferredLanguage}. If the user asks a question that requires information from the internet (like news, articles, or current events), use the 'searchWeb' tool to find the answer.`;
      
      // Directly map messages to the format Genkit expects for Gemini.
      const messagesForGemini = input.messages.map(msg => ({
          role: msg.role,
          content: [{ text: msg.content }]
      }));

      const genkitResponse = await ai.generate({
        model: activeModel,
        system: systemPrompt, // Use the dedicated system prompt field, this is the correct way.
        messages: messagesForGemini,
        tools: [searchWebTool],
        config: {
          temperature: 0.7,
        },
      });

      const responseText = genkitResponse.text;
      
      if (!responseText || responseText.trim().length === 0) {
        return { 
          response: "Sorry, the generated response was empty. Can you rephrase your question?", 
          success: true 
        };
      }

      return { 
        response: responseText.trim(), 
        success: true 
      };

    } catch (error: any) {
      console.error('❌ Critical error in multilingualChatFlow:', error);
      
      let errorMessage = 'An unexpected error occurred.';
      
      if (error.message?.includes('API key') || error.message?.includes('authentication')) {
        errorMessage = 'Authentication issue. Check your Google API key in GOOGLE_API_KEY.';
      } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        errorMessage = 'API quota exceeded. Please try again later.';
      } else if (error.message?.includes('model') || error.message?.includes('not found')) {
        errorMessage = `Model "${input.model || 'default'}" is not available.`;
      } else if (error.message?.includes('at least one message')) {
        errorMessage = 'No valid messages were sent to the AI.';
      } else if (error.message?.includes('system role')) {
        errorMessage = 'Role configuration error. The model does not support the system role in the message list.';
      } else {
        errorMessage = `Technical error: ${error.message}`;
      }
      
      return { 
        error: errorMessage, 
        success: false 
      };
    }
  }
);
