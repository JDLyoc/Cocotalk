'use server';
/**
 * @fileOverview A web search tool for the AI agent.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SearchResultSchema = z.object({
  title: z.string().describe('The title of the search result or article.'),
  summary: z.string().describe('A concise summary of the article content.'),
  source: z.string().describe('The name of the source website or publication (e.g., "Wikipedia", "TechCrunch").'),
});

const WebSearchInputSchema = z.object({
  query: z.string().describe('The search query, which should be specific and keyword-focused.'),
});

const WebSearchOutputSchema = z.object({
  results: z
    .array(SearchResultSchema)
    .describe('An array of relevant search results.'),
});

// This tool uses the DuckDuckGo Instant Answer API, which is a public, no-key-required API.
// It's not an official search API but is suitable for this prototype to perform live searches.
export const searchWebTool = ai.defineTool(
  {
    name: 'searchWeb',
    description:
      'Searches the web for recent articles, news, and data on a given topic. Use this to find facts, figures, and authoritative sources to support content creation.',
    inputSchema: WebSearchInputSchema,
    outputSchema: WebSearchOutputSchema,
  },
  async ({ query }) => {
    console.log(`Performing real web search for: ${query}`);
    try {
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
      if (!response.ok) {
        throw new Error(`Web search failed with status: ${response.status}`);
      }
      
      const data = await response.json();

      // DuckDuckGo API returns results in different fields. We check RelatedTopics, which is common for general queries.
      const rawResults = data.RelatedTopics || [];
      
      const results = rawResults
        .filter((item: any) => item.FirstURL && item.Text) // Ensure we have a URL and text to process
        .slice(0, 5) // Limit to the top 5 results
        .map((item: any) => {
          // The 'Text' field often contains "Title - Summary". We split it.
          const [title, ...summaryParts] = item.Text.split(' - ');
          const summary = summaryParts.join(' - ').trim();
          const source = new URL(item.FirstURL).hostname;

          return {
            title: title.trim(),
            summary: summary || 'No summary available.',
            source: source.replace(/^www\./, ''), // Clean up the source name (e.g., www.example.com -> example.com)
          };
        });

      return { results };

    } catch (error) {
      console.error("Error during web search:", error);
      // In case of a network or parsing error, we return an empty result set to avoid crashing the agent.
      // The error is logged to the server console for debugging.
      return { results: [] };
    }
  }
);
