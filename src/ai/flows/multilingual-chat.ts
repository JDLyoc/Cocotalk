
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
      
      if (!messages || messages.length === 0) {
        return { error: "INVALID_ARGUMENT: Au moins un message est requis pour démarrer une conversation." };
      }
      
      const genkitMessages: Message[] = messages.map(msg => ({
          role: msg.role as 'user' | 'model' | 'tool',
          content: [{ text: msg.content }]
      }));
      
      let historyForAI: Message[];
      
      // Determine the system prompt based on whether it's a standard chat or a Cocotalk
      if (rules) {
        // Cocotalk: Inject persona and rules as a system message.
        const fullPersona = persona || 'Vous êtes un assistant IA serviable, compétent et amical.';
        const systemPrompt = `Vous êtes un assistant conversationnel IA puissant et flexible.
Votre comportement est défini par la persona et les règles suivantes. Vous DEVEZ les suivre attentivement.

## Persona
${fullPersona}

## Règles & Scénario
${rules}

IMPORTANT: Vous devez TOUJOURS répondre en FRANÇAIS, quelle que soit la langue de l'utilisateur.`;

        historyForAI = [
          { role: 'user', content: [{ text: systemPrompt }] },
          { role: 'model', content: [{ text: "Oui, j'ai bien compris. Je suivrai ces instructions." }] },
          ...genkitMessages
        ];
      } else {
        // Standard Chat: Just add the "always French" instruction to the first user message.
        const firstUserMessage = genkitMessages[0];
        const instruction = "RÉPONDEZ TOUJOURS EN FRANÇAIS, quelle que soit la langue de l'utilisateur.\n\n";
        
        firstUserMessage.content[0].text = instruction + firstUserMessage.content[0].text;
        
        historyForAI = genkitMessages;
      }
      

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
          return { response: "Désolé, je n'ai pas pu générer une réponse." };
      }

      return { response: responseText };

    } catch (error: any)
    {
      console.error('Critical error in multilingualChatFlow:', error);
      
      let errorMessage = `Une erreur est survenue: ${error.message}`;
      if (error.message?.includes('API key not valid')) {
        errorMessage = `La clé API Google est invalide. Veuillez vérifier la variable GOOGLE_API_KEY dans votre fichier .env.`;
      } else if (error.message?.includes('permission') || error.message?.includes('denied')) {
        errorMessage = `Erreur de permission. Causes probables :
1. Restrictions sur la clé API : Dans la console Google Cloud > API et services > Identifiants > [Votre Clé API], assurez-vous que "Restrictions relatives aux applications" est sur "Aucun" ET que "Restrictions relatives aux API" est sur "Ne pas restreindre la clé".
2. API non activée : Vérifiez que l'API "Gemini" est bien activée pour ce projet.
3. Facturation non liée : Assurez-vous que la facturation est activée et liée à ce projet.
4. Mauvais projet sélectionné : Vérifiez que le projet affiché en haut de la console Google Cloud est bien le bon.`;
      } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        errorMessage = 'Le service est temporairement surchargé. Veuillez réessayer dans quelques instants.';
      } else if (error.message?.includes('Schema validation failed')) {
        errorMessage = `Une erreur de validation des données est survenue, indiquant une incohérence entre les données envoyées et le format attendu par l'IA. Détails: ${error.message}`;
      }

      return { error: errorMessage };
    }
  }
);
