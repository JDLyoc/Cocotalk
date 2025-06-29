'use server';

/**
 * @fileOverview Chat AI with standard capabilities, no web search.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Schema for messages
const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string().min(1, 'Message content cannot be empty'),
});

// Input schema for the flow
const MultilingualChatInputSchema = z.object({
  messages: z.array(MessageSchema).min(1, 'At least one message is required'),
  model: z.string().optional(),
  language: z.string().optional(),
});
export type MultilingualChatInput = z.infer<typeof MultilingualChatInputSchema>;

// Output schema for the flow
const MultilingualChatOutputSchema = z.object({
  response: z.string().optional(),
  error: z.string().optional(),
  success: z.boolean(),
});
export type MultilingualChatOutput = z.infer<typeof MultilingualChatOutputSchema>;


// Main function called by the UI actions
export async function multilingualChat(input: MultilingualChatInput): Promise<MultilingualChatOutput> {
  try {
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

// The core Genkit flow
const multilingualChatFlow = ai.defineFlow(
  {
    name: 'multilingualChatFlow',
    inputSchema: MultilingualChatInputSchema,
    outputSchema: MultilingualChatOutputSchema,
  },
  async (input) => {
    try {
      const activeModel = input.model || 'googleai/gemini-1.5-flash-latest';
      const preferredLanguage = input.language || 'the user\'s language';

      // Prepare messages with system instructions for Gemini
      const messagesForGemini = prepareMessages(
        input.messages, 
        preferredLanguage
      );
      
      // Call the Gemini API
      const genkitResponse = await ai.generate({
        model: activeModel,
        messages: messagesForGemini,
        config: {
          temperature: 0.7,
        },
      });

      // Extract the response text
      const responseText = extractResponseText(genkitResponse);
      
      if (!responseText || responseText.trim().length === 0) {
        return { 
          response: "Désolé, je n'ai pas pu générer de réponse.", 
          success: true
        };
      }

      return { 
        response: responseText.trim(), 
        success: true
      };

    } catch (error: any) {
      console.error('❌ Error in multilingualChatFlow:', error);
      const errorMessage = getErrorMessage(error);
      return { 
        error: errorMessage, 
        success: false 
      };
    }
  }
);


// Helper to prepare messages with system instructions
function prepareMessages(
  messages: MultilingualChatInput['messages'], 
  preferredLanguage: string
) {
  const systemInstruction = `You are a helpful and conversational assistant. Please respond in ${preferredLanguage}.`;
  
  const preparedMessages: any[] = [];
  
  messages.forEach((msg, index) => {
    // Skip empty messages
    if (!msg.content || msg.content.trim().length === 0) {
      return;
    }

    let content = msg.content.trim();
    
    // Prepend instructions to the first user message
    if (index === 0 && msg.role === 'user') {
      content = `System instruction: You are a helpful and conversational assistant. Please respond in ${preferredLanguage}.\n\n---\n\nUser's question: "${content}"`;
    }
    
    preparedMessages.push({
      role: msg.role,
      content: [{ text: content }] // Format for multi-modal compatibility
    });
  });
  
  return preparedMessages;
}


// Utility to safely extract text from the AI response
function extractResponseText(genkitResponse: any): string {
    if (!genkitResponse) return '';
    const textValue = genkitResponse.text;
    if (typeof textValue === 'string') {
        return textValue;
    }
    if (typeof textValue === 'function') {
        try {
            return textValue();
        } catch {
            return '';
        }
    }
    if (genkitResponse.output?.text) {
        return genkitResponse.output.text;
    }
    return '';
}

// Utility to create a user-friendly error message
function getErrorMessage(error: any): string {
  if (error.message?.includes('API key') || error.message?.includes('authentication')) {
    return 'Problème d\'authentification. Vérifiez vos clés API.';
  } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
    return 'Quota API dépassé. Veuillez réessayer plus tard.';
  } else if (error.message?.includes('model')) {
    return 'Modèle non disponible.';
  } else {
    return `Erreur technique: ${error.message}`;
  }
}
