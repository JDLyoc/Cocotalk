'use server';

/**
 * @fileOverview A simplified, robust, multilingual chat AI agent.
 * Fixed for Gemini API compatibility
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the shape of a single message for input validation
const MessageSchema = z.object({
  role: z.enum(['user', 'model']), // Seulement user et model pour Gemini
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
      // Double vérification des messages
      if (!input.messages || input.messages.length === 0) {
        return { 
          error: 'No messages provided to the AI. Please send at least one message.', 
          success: false 
        };
      }

      const activeModel = input.model || 'googleai/gemini-1.5-flash-latest';
      const preferredLanguage = input.language || 'the same language as the user';
      
      // Préparer les messages pour Gemini (PAS de rôle system)
      const messagesForGemini = prepareMessagesForGemini(input.messages, preferredLanguage);
      
      // Vérifier qu'on a des messages valides
      if (!messagesForGemini || messagesForGemini.length === 0) {
        return { 
          error: 'No valid messages could be prepared for the AI.', 
          success: false 
        };
      }

      // Appel à l'API Gemini
      const genkitResponse = await ai.generate({
        model: activeModel,
        messages: messagesForGemini, // Utiliser messages, pas history
        config: {
          temperature: 0.7,
        },
      });


      // Extraire le texte de la réponse
      const responseText = genkitResponse.text;
      
      if (!responseText || responseText.trim().length === 0) {
        return { 
          response: "Désolé, la réponse générée était vide. Pouvez-vous reformuler votre question ?", 
          success: true 
        };
      }

      return { 
        response: responseText.trim(), 
        success: true 
      };

    } catch (error: any) {
      console.error('❌ Critical error in multilingualChatFlow:', error);
      
      let errorMessage = 'Une erreur inattendue s\'est produite.';
      
      if (error.message?.includes('API key') || error.message?.includes('authentication')) {
        errorMessage = 'Problème d\'authentification. Vérifiez votre clé API Google dans GOOGLE_API_KEY.';
      } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        errorMessage = 'Quota API dépassé. Veuillez réessayer plus tard.';
      } else if (error.message?.includes('model') || error.message?.includes('not found')) {
        errorMessage = `Modèle "${input.model || 'default'}" non disponible.`;
      } else if (error.message?.includes('at least one message')) {
        errorMessage = 'Aucun message valide n\'a été envoyé à l\'IA.';
      } else if (error.message?.includes('system role')) {
        errorMessage = 'Erreur de configuration des rôles. Le modèle ne supporte pas le rôle system.';
      } else {
        errorMessage = `Erreur technique: ${error.message}`;
      }
      
      return { 
        error: errorMessage, 
        success: false 
      };
    }
  }
);

// Fonction pour préparer les messages spécifiquement pour Gemini
function prepareMessagesForGemini(messages: MultilingualChatInput['messages'], preferredLanguage: string) {
  if (!messages || messages.length === 0) {
    return [];
  }

  // Instructions système intégrées dans le premier message utilisateur
  const systemInstruction = `Your instructions: Respond in ${preferredLanguage}. Be a helpful and conversational assistant.`;
  
  const preparedMessages: { role: 'user' | 'model'; content: { text: string }[] }[] = [];
  
  messages.forEach((msg, index) => {
    if (!msg.content || msg.content.trim().length === 0) {
      return;
    }

    let content = msg.content.trim();
    
    // Ajouter les instructions au premier message utilisateur
    if (index === 0 && msg.role === 'user') {
      content = `${systemInstruction}\n\n---\n\n${content}`;
    }
    
    preparedMessages.push({
      role: msg.role,
      content: [{ text: content }]
    });
  });
  
  // If the first message was not from a user, inject instructions differently
  if (messages[0].role !== 'user') {
    preparedMessages.unshift({
        role: 'user',
        content: [{ text: systemInstruction + "\n\n---\n\nLet's start." }],
    });
    preparedMessages.push({
        role: 'model',
        content: [{ text: "Understood. I will follow these instructions. How can I help you?" }]
    });
  }

  return preparedMessages;
}