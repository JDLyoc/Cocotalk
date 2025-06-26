'use server';

/**
 * @fileOverview A stateful, multilingual chat AI agent for SEO content creation.
 * It follows a predefined scenario with branching logic.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { searchWebTool } from '../tools/web-search';
import type { Message } from 'genkit';

// Define the possible states of the conversation
const ConversationStateSchema = z.enum([
  'AWAITING_KEYWORD',
  'AWAITING_ACTION_CHOICE',
  'UPDATING_H2_AWAITING_H2_TITLE',
  'UPDATING_H2_SEARCHING',
  'UPDATING_H2_AWAITING_CONFIRMATION',
  'UPDATING_H2_GENERATING',
  'UPDATING_H2_AWAITING_FEEDBACK',
  'CREATING_H2_SEARCHING',
  'CREATING_H2_AWAITING_TOPIC_CHOICE',
  'CREATING_H2_GENERATING',
  'CREATING_H2_AWAITING_FEEDBACK',
  'CONVERSATION_END',
]);
type ConversationState = z.infer<typeof ConversationStateSchema>;


const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const MultilingualChatInputSchema = z.object({
  messages: z.array(MessageSchema).describe('The entire conversation history.'),
  state: ConversationStateSchema.describe('The current state of the conversation.'),
  persona: z.string().optional().describe('The persona the assistant should adopt.'),
  rules: z.string().optional().describe('General SEO and writing rules to follow at all times.'),
});
export type MultilingualChatInput = z.infer<typeof MultilingualChatInputSchema>;

const MultilingualChatOutputSchema = z.object({
  response: z.string().describe('The chatbot response in the same language as the user message.'),
  nextState: ConversationStateSchema.describe('The next state of the conversation.'),
});
export type MultilingualChatOutput = z.infer<typeof MultilingualChatOutputSchema>;


export async function multilingualChat(input: MultilingualChatInput): Promise<MultilingualChatOutput> {
  return multilingualChatFlow(input);
}


// A simple prompt for generating user-facing text based on instructions.
const generationPrompt = ai.definePrompt({
    name: 'seoAgentGenerator',
    input: { schema: z.object({ instructions: z.string(), context: z.string().optional(), persona: z.string().optional(), rules: z.string().optional() }) },
    output: { schema: z.object({ response: z.string() }) },
    system: `You are an expert SEO content assistant. Follow the user's instructions precisely.
    Your persona: {{{persona}}}.
    General rules to follow: {{{rules}}}.
    
    Current context for your task:
    {{{context}}}
    `,
    prompt: `{{{instructions}}}`,
});

// The main flow, which acts as a state machine.
const multilingualChatFlow = ai.defineFlow(
  {
    name: 'multilingualChatFlow',
    inputSchema: MultilingualChatInputSchema,
    outputSchema: MultilingualChatOutputSchema,
  },
  async (input) => {
    const { messages, state, persona, rules } = input;
    const lastUserMessage = messages.findLast(m => m.role === 'user')?.content || '';
    const history = messages.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n');
    let output: MultilingualChatOutput;

    switch (state) {
      case 'AWAITING_KEYWORD':
        if (!lastUserMessage.trim()) {
            output = {
                response: "Bonjour ! Je suis votre assistant SEO. Pour commencer, quel est le mot-clé principal que vous souhaitez optimiser ?",
                nextState: 'AWAITING_KEYWORD',
            };
        } else {
            output = {
                response: `Parfait, nous allons travailler sur le mot-clé "**${lastUserMessage}**".\n\nQue souhaitez-vous faire ?\n1. 🔄 Mettre à jour un paragraphe existant\n2. ➕ Créer un nouveau paragraphe (avec H2)`,
                nextState: 'AWAITING_ACTION_CHOICE',
            };
        }
        break;

      case 'AWAITING_ACTION_CHOICE':
        if (lastUserMessage.includes('1') || lastUserMessage.toLowerCase().includes('mettre à jour')) {
          output = {
            response: "Très bien. Quel est le H2 (le titre) du paragraphe que vous souhaitez mettre à jour ?",
            nextState: 'UPDATING_H2_AWAITING_H2_TITLE',
          };
        } else if (lastUserMessage.includes('2') || lastUserMessage.toLowerCase().includes('créer')) {
          const keyword = messages.find(m => m.role === 'model' && m.content.startsWith('Parfait, nous allons'))?.content.match(/\*\*(.*)\*\*/)?.[1] || '';
          const {text} = await generationPrompt({ instructions: "Je vais lancer une recherche sur le web pour proposer des idées de nouveaux H2 liés au mot-clé. Vous pourrez modifier ou ajouter d'autres mots-clés si vous le souhaitez.", context: `Mot-clé: ${keyword}`, persona, rules });
          
          // In a real scenario, we would trigger the search tool here and transition.
          // For now, we move directly to proposing topics.
          const searchResponse = await searchWebTool({ query: `Idées de H2 pour ${keyword}` });
          const topicList = searchResponse.results.slice(0, 5).map((r, i) => `${i + 1}. ${r.title}`).join('\n');

          output = {
            response: `Voici 5 idées de sujets H2 basées sur les tendances actuelles :\n\n${topicList}\n\nSouhaitez-vous que je rédige un paragraphe sur l'un de ces sujets ? Ou préférez-vous relancer la recherche ou proposer votre propre H2 ?`,
            nextState: 'CREATING_H2_AWAITING_TOPIC_CHOICE',
          };
        } else {
          output = {
            response: "Je n'ai pas compris. Veuillez choisir '1' pour mettre à jour ou '2' for créer.",
            nextState: 'AWAITING_ACTION_CHOICE',
          };
        }
        break;

      case 'UPDATING_H2_AWAITING_H2_TITLE':
        const keywordForUpdate = messages.find(m => m.role === 'model' && m.content.startsWith('Parfait, nous allons'))?.content.match(/\*\*(.*)\*\*/)?.[1] || '';
        const h2ForUpdate = lastUserMessage;
        
        // This simulates the AI thinking and using the tool.
        const searchResponse = await searchWebTool({ query: `${keywordForUpdate} ${h2ForUpdate} actualités 2025` });
        const newsList = searchResponse.results.slice(0, 5).map(r => `**${r.title}** (${r.source})\n*${r.summary}*`).join('\n\n');

        output = {
            response: `J'ai analysé "**${h2ForUpdate}**" et voici 5 actualités pertinentes de 2025 que j'ai trouvées :\n\n${newsList}\n\nSouhaitez-vous que je procède à la mise à jour de ce H2 en utilisant ces informations ?`,
            nextState: 'UPDATING_H2_AWAITING_CONFIRMATION',
        };
        break;

      case 'UPDATING_H2_AWAITING_CONFIRMATION':
        if (lastUserMessage.toLowerCase().includes('oui')) {
            const {output: generation} = await generationPrompt({ instructions: "Rédige un ou plusieurs paragraphes optimisés pour le SEO, en intégrant les informations des actualités récentes. Ne mets pas de titre H2. Commence directement par le contenu.", context: history, persona, rules });
            output = {
                response: `${generation.response}\n\nSouhaitez-vous modifier quelque chose ou êtes-vous satisfait ?`,
                nextState: 'UPDATING_H2_AWAITING_FEEDBACK',
            };
        } else {
            output = {
                response: "D'accord. Que souhaitez-vous faire ?\n1. 🔄 Mettre à jour un autre paragraphe\n2. ➕ Créer un nouveau paragraphe",
                nextState: 'AWAITING_ACTION_CHOICE',
            };
        }
        break;
      
      case 'CREATING_H2_AWAITING_TOPIC_CHOICE':
        const {output: creation} = await generationPrompt({ instructions: "Rédige un paragraphe optimisé SEO pour le sujet choisi par l'utilisateur. Inclus le titre H2 au début.", context: history, persona, rules });
        output = {
          response: `${creation.response}\n\nCe paragraphe vous convient-il ou souhaitez-vous le modifier ?`,
          nextState: 'CREATING_H2_AWAITING_FEEDBACK',
        };
        break;

      case 'UPDATING_H2_AWAITING_FEEDBACK':
      case 'CREATING_H2_AWAITING_FEEDBACK':
        output = {
            response: "Parfait ! Que souhaitez-vous faire maintenant ?\n1. 🔄 Mettre à jour un paragraphe existant\n2. ➕ Créer un nouveau paragraphe",
            nextState: 'AWAITING_ACTION_CHOICE',
        };
        break;

      default:
        output = {
          response: "Je suis un peu perdu. Recommençons. Quel est votre mot-clé principal ?",
          nextState: 'AWAITING_KEYWORD',
        };
    }

    return output;
  }
);
