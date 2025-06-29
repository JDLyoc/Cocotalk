'use server';

/**
 * @fileOverview Chat AI avec capacité de recherche web
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Schema pour les messages
const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string().min(1, 'Message content cannot be empty'),
});

// Schema d'entrée
const MultilingualChatInputSchema = z.object({
  messages: z.array(MessageSchema).min(1, 'At least one message is required'),
  model: z.string().optional(),
  language: z.string().optional(),
  enableWebSearch: z.boolean().optional().default(true),
});

export type MultilingualChatInput = z.infer<typeof MultilingualChatInputSchema>;

// Schema de sortie
const MultilingualChatOutputSchema = z.object({
  response: z.string().optional(),
  error: z.string().optional(),
  success: z.boolean(),
  searchUsed: z.boolean().optional(),
  sources: z.array(z.string()).optional(),
});

export type MultilingualChatOutput = z.infer<typeof MultilingualChatOutputSchema>;

// Fonction principale
export async function multilingualChat(input: MultilingualChatInput): Promise<MultilingualChatOutput> {
  try {
    console.log('🔍 Input received:', JSON.stringify(input, null, 2));
    
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
      console.log('🚀 Flow started with web search enabled:', input.enableWebSearch);

      const activeModel = input.model || 'googleai/gemini-1.5-flash-latest';
      const preferredLanguage = input.language || 'the user\'s language';
      
      // Récupérer le dernier message utilisateur
      const lastUserMessage = getLastUserMessage(input.messages);
      if (!lastUserMessage) {
        return { 
          error: 'No user message found', 
          success: false 
        };
      }

      let searchResults: string[] = [];
      let searchContext = '';
      let searchUsed = false;

      // Décider si une recherche web est nécessaire
      if (input.enableWebSearch && needsWebSearch(lastUserMessage.content)) {
        console.log('🔍 Web search needed for query:', lastUserMessage.content);
        
        const searchResult = await performWebSearch(lastUserMessage.content);
        
        // Si la recherche a réussi ET a renvoyé du contenu...
        if (searchResult.success && searchResult.content) {
          searchContext = searchResult.content;
          searchResults = searchResult.sources || [];
          searchUsed = true;
          console.log('✅ Web search completed');
        } 
        // Si la recherche a échoué MAIS a renvoyé un message d'erreur...
        else if (!searchResult.success && searchResult.content) {
          console.log('⚠️ Web search failed, returning error message directly to user.');
          // On retourne directement le message d'erreur à l'utilisateur.
          // C'est plus clair que de laisser l'IA répondre.
          return {
            response: searchResult.content,
            success: true, // Le flux a réussi à produire une réponse (le message d'erreur).
            searchUsed: false,
          };
        } 
        // Si la recherche a échoué sans message, on continue sans.
        else {
          console.log('⚠️ Web search failed silently, continuing without it.');
        }
      }

      // Préparer les messages avec le contexte web si disponible
      const messagesForGemini = prepareMessagesWithWebContext(
        input.messages, 
        preferredLanguage, 
        searchContext
      );
      
      console.log('📝 Messages prepared, count:', messagesForGemini.length);

      // Appel à l'API Gemini
      const genkitResponse = await ai.generate({
        model: activeModel,
        messages: messagesForGemini,
        config: {
          temperature: 0.7,
        },
      });

      // Extraire la réponse
      let responseText = extractResponseText(genkitResponse);
      
      if (!responseText || responseText.trim().length === 0) {
        return { 
          response: "Désolé, je n'ai pas pu générer de réponse.", 
          success: true,
          searchUsed 
        };
      }

      return { 
        response: responseText.trim(), 
        success: true,
        searchUsed,
        sources: searchUsed ? searchResults : undefined
      };

    } catch (error: any) {
      console.error('❌ Error in multilingualChatFlow:', error);
      
      let errorMessage = getErrorMessage(error);
      
      return { 
        error: errorMessage, 
        success: false 
      };
    }
  }
);

// Détecter si une recherche web est nécessaire
function needsWebSearch(userMessage: string): boolean {
  const currentKeywords = [
    'actualité', 'actualités', 'news', 'aujourd\'hui', 'maintenant', 'récent',
    'dernière', 'dernières', 'current', 'latest', 'breaking', 'info du jour',
    'quoi de neuf', 'what\'s new', 'recent', 'prix actuel', 'cours de',
    'météo', 'weather', 'trafic', 'traffic', 'score', 'résultat',
    'élection', 'politique', 'bourse', 'crypto', 'bitcoin', 'stock',
    'covid', 'virus', 'épidémie', 'vaccination', 'statistiques',
    'guerre', 'conflit', 'urgence', 'alerte', 'incident', 'rfi'
  ];

  const timeKeywords = [
    '2024', '2025', 'cette année', 'ce mois', 'cette semaine',
    'hier', 'avant-hier', 'la semaine dernière', 'le mois dernier'
  ];

  const message = userMessage.toLowerCase();
  
  return currentKeywords.some(keyword => message.includes(keyword)) ||
         timeKeywords.some(keyword => message.includes(keyword)) ||
         message.includes('?') && (message.includes('quand') || message.includes('when'));
}

async function performWebSearch(query: string): Promise<{
  success: boolean;
  content?: string;
  sources?: string[];
}> {
  try {
    // OPTION 1: Utiliser l'API Serper (recommandé)
    if (process.env.SERPER_API_KEY) {
      return await searchWithSerper(query);
    }
    
    // OPTION 2: Utiliser l'API Brave Search
    if (process.env.BRAVE_API_KEY) {
      return await searchWithBrave(query);
    }
    
    // OPTION 3: Utiliser Google Custom Search
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      return await searchWithGoogle(query);
    }
    
    // Fallback: message d'erreur clair si aucune clé n'est configurée.
    return {
      success: false,
      content: "La recherche web n'est pas configurée. Veuillez ajouter une clé API de recherche (par exemple, SERPER_API_KEY) dans votre fichier .env et redémarrer le serveur."
    };
    
  } catch (error: any) {
    console.error('Web search error:', error);
    const friendlyMessage = "Désolé, la recherche sur le web a échoué. Cela peut être dû à une clé API invalide ou à un problème de réseau.";
    return { success: false, content: friendlyMessage };
  }
}

// Recherche avec Serper API (gratuit jusqu'à 2500 requêtes/mois)
async function searchWithSerper(query: string) {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: 5,
      hl: 'fr'
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Serper API error: ${response.status}`, errorBody);
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json();
  
  let content = '';
  const sources: string[] = [];
  
  if (data.answerBox) {
    content += `Réponse directe: ${data.answerBox.snippet || data.answerBox.answer}\n\n`;
  }

  if (data.organic) {
    data.organic.slice(0, 3).forEach((result: any) => {
      content += `Titre: ${result.title}\nExtrait: ${result.snippet}\n\n`;
      sources.push(result.link);
    });
  }
  
  return { success: true, content, sources };
}

// Recherche avec Brave Search API
async function searchWithBrave(query: string) {
  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
    {
      headers: {
        'X-Subscription-Token': process.env.BRAVE_API_KEY!,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status}`);
  }

  const data = await response.json();
  
  let content = '';
  const sources: string[] = [];
  
  if (data.web?.results) {
    data.web.results.slice(0, 3).forEach((result: any) => {
      content += `${result.title}\n${result.description}\n\n`;
      sources.push(result.url);
    });
  }
  
  return { success: true, content, sources };
}

// Recherche avec Google Custom Search
async function searchWithGoogle(query: string) {
  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`
  );

  if (!response.ok) {
    throw new Error(`Google Search API error: ${response.status}`);
  }

  const data = await response.json();
  
  let content = '';
  const sources: string[] = [];
  
  if (data.items) {
    data.items.slice(0, 3).forEach((result: any) => {
      content += `${result.title}\n${result.snippet}\n\n`;
      sources.push(result.link);
    });
  }
  
  return { success: true, content, sources };
}

// Préparer les messages avec contexte web
function prepareMessagesWithWebContext(
  messages: MultilingualChatInput['messages'], 
  preferredLanguage: string, 
  searchContext: string
) {
  const baseInstruction = `You are a helpful and conversational assistant. Please respond in ${preferredLanguage}.`;
  
  let systemInstruction = baseInstruction;
  
  if (searchContext) {
    systemInstruction += `\n\nUse the following context from a web search to answer the user's question. Based on this context, provide a comprehensive answer. Cite your sources if possible. \n\n## Web Search Context ##\n${searchContext}`;
  }
  
  const preparedMessages: any[] = [];
  
  messages.forEach((msg, index) => {
    if (!msg.content || msg.content.trim().length === 0) {
      return;
    }

    let content = msg.content.trim();
    
    // Ajouter les instructions au premier message utilisateur
    if (index === 0 && msg.role === 'user') {
      content = `${systemInstruction}\n\n---\n\nUser's question: "${content}"`;
    }
    
    preparedMessages.push({
      role: msg.role,
      content: [{ text: content }]
    });
  });
  
  return preparedMessages;
}

// Utilitaires
function getLastUserMessage(messages: MultilingualChatInput['messages']) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i];
    }
  }
  return null;
}

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
