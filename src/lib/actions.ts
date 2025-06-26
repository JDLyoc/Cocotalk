'use server';

import {
  multilingualChat,
  type MultilingualChatInput,
  type MultilingualChatOutput,
} from '@/ai/flows/multilingual-chat';
import type {Message} from 'genkit';
import type {StoredCocotalk, StoredMessage} from './types';
import type {AvailableModel} from '@/contexts/model-context';

interface InvokeAiChatInput {
  conversationHistory: StoredMessage[];
  messageContent: string;
  model: AvailableModel;
  activeCocotalk: StoredCocotalk | null;
}

// This server action ONLY calls the AI. It does not touch the database.
// All database operations are handled on the client where the user is authenticated.
export async function invokeAiChat(
  input: InvokeAiChatInput
): Promise<MultilingualChatOutput> {
  const {conversationHistory, messageContent, model, activeCocotalk} = input;

  try {
    // We construct the history for Genkit from our stored messages.
    const historyForGenkit: Message[] = conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add the new user message to the history.
    historyForGenkit.push({role: 'user', content: messageContent});

    const aiInput: MultilingualChatInput = {
      messages: historyForGenkit,
      persona: activeCocotalk?.persona,
      rules: activeCocotalk?.instructions,
      model: model,
    };

    const result = await multilingualChat(aiInput);

    return result;
  } catch (error: any) {
    console.error('Error in invokeAiChat server action:', error);
    return {
      error: `An unexpected error occurred while contacting the AI: ${error.message}`,
    };
  }
}
