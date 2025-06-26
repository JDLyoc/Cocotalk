
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

// Define the schema for a single message in the conversation
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


// The exported function that the application will call.
export async function multilingualChat(input: MultilingualChatInput): Promise<MultilingualChatOutput> {
  return multilingualChatFlow(input);
}


// The main flow. It now properly handles tool calls in a loop.
const multilingualChatFlow = ai.defineFlow(
  {
    name: 'multilingualChatFlow',
    inputSchema: MultilingualChatInputSchema,
    outputSchema: MultilingualChatOutputSchema,
  },
  async (input) => {
    const { messages, persona, rules, model } = input;
    const activeModel = model || 'googleai/gemini-2.0-flash';
    
    // Make a mutable copy to avoid side effects
    let historyForGenkit: Message[] = JSON.parse(JSON.stringify(messages));

    // For a standard chat, persona and rules will be undefined, and this block will be skipped.
    // For a Cocotalk, we inject the instructions into the first user message.
    if (persona || rules) {
      const systemPromptText = `You are a powerful and flexible conversational AI assistant.
Your behavior is defined by the following persona and rules. You MUST follow them.

## Persona
${persona || 'You are a helpful general-purpose assistant.'}

## Rules & Scenario
Your main task is to follow this scenario. Analyze the entire conversation history to determine the current step and what to do next. Do not repeat steps that are already completed. Always respond in the language of the last user message.
---
${rules || 'Have a friendly and helpful conversation with the user.'}
---

## Available Tools
You have access to a web search tool. Use it by calling 'searchWeb' when you need recent information, facts, news, or up-to-date data to answer a user's request.
`;

      // Inject the system prompt into the first user message, which is how Gemini prefers it.
      if (historyForGenkit.length > 0 && historyForGenkit[0].role === 'user') {
        historyForGenkit[0].content = `${systemPromptText}\n\n---\n\nUser Request:\n${historyForGenkit[0].content}`;
      } else {
        // If history is empty or starts with the model, add a new user message.
        historyForGenkit.unshift({ role: 'user', content: systemPromptText });
      }
    }

    // FINAL SAFEGUARD: Ensure we never call the AI with an empty history.
    if (historyForGenkit.length === 0) {
        console.error("CRITICAL: multilingualChatFlow history is empty right before calling ai.generate(). This should have been caught earlier.");
        return { response: "Je suis désolé, une erreur interne m'empêche de répondre. Veuillez réessayer." };
    }

    // Start the generation process
    let genkitResponse = await ai.generate({
      model: activeModel,
      history: historyForGenkit,
      tools: [searchWebTool],
      toolChoice: 'auto', 
    });

    // Loop to handle tool calls until a final text response is generated
    while (true) {
        // If the response is text, we are done.
        if (genkitResponse.text) {
            break;
        }

        const toolCalls = genkitResponse.toolCalls();
        if (toolCalls.length > 0) {
            const toolOutputs: any[] = [];
            // Execute each requested tool
            for (const call of toolCalls) {
                console.log('Tool call requested:', call);
                const output = await ai.runTool(call);
                toolOutputs.push(output);
            }
            
            // Re-run generation with the tool results included in the history
            genkitResponse = await ai.generate({
                model: activeModel,
                history: [...historyForGenkit, genkitResponse.message, ...toolOutputs],
                tools: [searchWebTool],
                toolChoice: 'auto',
            });
        } else {
            // If there's no text and no tool call, it's an abnormal state.
            // Break the loop to prevent an infinite loop.
            console.warn("Generation response has no text and no tool calls. Breaking loop.");
            break;
        }
    }

    const text = genkitResponse?.text ?? '';

    return { response: text };
  }
);
