
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
  role: z.enum(['user', 'model']),
  content: z.string(),
});

// The input for the generic chat flow.
// It takes the full conversation history and the rules/persona for the agent.
const MultilingualChatInputSchema = z.object({
  messages: z.array(MessageSchema).describe('The entire conversation history, from oldest to newest.'),
  persona: z.string().optional().describe('The persona the assistant should adopt.'),
  rules: z.string().optional().describe('The user-defined scenario, rules, and instructions the agent must follow.'),
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
    const { messages, persona, rules } = input;
    
    const systemPrompt = `You are a powerful and flexible conversational AI assistant.
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

    // Start the generation process
    let genkitResponse = await ai.generate({
      model: 'googleai/gemini-2.0-flash', // Using the app's default model
      system: systemPrompt,
      history: messages as Message[],
      tools: [searchWebTool],
      toolChoice: 'auto', 
    });

    // Loop to handle tool calls until a final text response is generated
    while (true) {
        // If the response is text, we're done. Break the loop.
        if (genkitResponse.text) {
            break;
        }

        // If the response contains tool calls, execute them.
        const toolCalls = genkitResponse.toolCalls();
        if (toolCalls.length > 0) {
            const toolOutputs: any[] = [];
            // Execute each tool requested by the model
            for (const call of toolCalls) {
                console.log('Tool call requested:', call);
                const output = await ai.runTool(call);
                toolOutputs.push(output);
            }
            
            // Send the tool results back to the model to get a final response
            genkitResponse = await ai.generate({
                model: 'googleai/gemini-2.0-flash', // Using the app's default model
                system: systemPrompt,
                // The history now includes the model's request and the tool's output
                history: [...(messages as Message[]), genkitResponse.message, ...toolOutputs], 
                tools: [searchWebTool],
                toolChoice: 'auto',
            });
        } else {
            // If there's no text and no tool calls, it's an unusual state.
            // Break the loop to prevent it from running forever.
            console.warn("Generation response has no text and no tool calls. Breaking loop.");
            break;
        }
    }

    // The final defensive check, applied after the tool-calling loop is complete.
    const text = genkitResponse?.text ?? '';

    return { response: text };
  }
);
