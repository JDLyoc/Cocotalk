'use server';
/**
 * @fileOverview A web search tool for the AI agent.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SearchResultSchema = z.object({
  title: z.string().describe('The title of the search result or article.'),
  summary: z.string().describe('A concise summary of the article content.'),
  source: z.string().describe('The name of the source website or publication (e.g., "Le Monde", "TechCrunch").'),
});

const WebSearchInputSchema = z.object({
  query: z.string().describe('The search query, which should be specific and keyword-focused.'),
});

const WebSearchOutputSchema = z.object({
  results: z
    .array(SearchResultSchema)
    .describe('An array of relevant search results.'),
});

// A map of keywords to mock results to make the simulation more realistic
const mockResults: Record<string, z.infer<typeof WebSearchOutputSchema>> = {
    'default': {
        results: [
          { title: 'Les tendances IA de 2025', summary: 'L\'IA générative continue de dominer les discussions technologiques, avec des avancées majeures dans les modèles multimodaux.', source: 'Le Monde' },
          { title: 'Régulation de l\'IA en Europe', summary: 'La nouvelle législation européenne sur l\'IA (AI Act) entre en vigueur, imposant de nouvelles contraintes aux entreprises.', source: 'Les Echos' },
          { title: 'Comment l\'IA transforme le SEO', summary: 'Les experts discutent de l\'impact de la recherche générative (SGE) sur les stratégies de contenu et le classement.', source: 'Search Engine Journal' },
          { title: 'L\'économie des créateurs en 2025', summary: 'Une étude de l\'INSEE montre une croissance de 15% du secteur, portée par les nouvelles plateformes de monétisation.', source: 'INSEE' },
          { title: 'Cybersécurité : les menaces de demain', summary: 'Les attaques par phishing assistées par IA sont en hausse, selon le dernier rapport de la CNIL.', source: 'CNIL' },
        ],
    },
    'H2': {
        results: [
            { title: 'Top 10 des stratégies de contenu pour 2025', summary: 'Le contenu vidéo et les formats interactifs sont essentiels pour engager le public cible.', source: 'HubSpot Blog' },
            { title: 'L\'importance de l\'EEAT en SEO', summary: 'Google renforce ses critères d\'Expertise, d\'Autorité et de Confiance pour évaluer la qualité des contenus.', source: 'Moz' },
            { title: 'Comment utiliser l\'IA pour trouver des mots-clés de longue traîne', summary: 'Des outils basés sur l\'IA permettent d\'identifier des niches de mots-clés à fort potentiel de conversion.', source: 'Ahrefs' },
            { title: 'L\'avenir de la recherche vocale', summary: 'Avec la popularité des assistants vocaux, l\'optimisation pour la recherche vocale devient une priorité pour les entreprises locales.', source: 'Journal Du Net' },
            { title: 'Étude de cas : doubler son trafic organique en 6 mois', summary: 'Une analyse détaillée d\'une stratégie SEO réussie, combinant contenu de qualité et netlinking.', source: 'Semrush Blog' },
        ],
    }
};


export const searchWebTool = ai.defineTool(
  {
    name: 'searchWeb',
    description:
      'Searches the web for recent articles, news, and data on a given topic. Use this to find facts, figures, and authoritative sources from 2025 to support content creation.',
    inputSchema: WebSearchInputSchema,
    outputSchema: WebSearchOutputSchema,
  },
  async ({ query }) => {
    // In a real app, this would call a search API like Google Search or Bing.
    // For this prototype, we return mock data based on the query.
    console.log(`Simulating web search for: ${query}`);

    const queryKey = Object.keys(mockResults).find(key => query.toLowerCase().includes(key.toLowerCase())) || 'default';
    
    return mockResults[queryKey];
  }
);
