'use server';

import {
  multilingualChat,
  type MultilingualChatInput,
  type MultilingualChatOutput,
} from '@/ai/flows/multilingual-chat';
import type { Message } from 'genkit';
import type { StoredCocotalk, StoredMessage } from './types';
import type { AvailableModel } from '@/contexts/model-context';

interface InvokeAiChatInput {
  historyWithNewMessage: StoredMessage[];
  model: AvailableModel;
  activeCocotalk: StoredCocotalk | null;
}

export async function invokeAiChat(
  input: InvokeAiChatInput
): Promise<MultilingualChatOutput> {
  const { historyWithNewMessage, model, activeCocotalk } = input;

  const historyForGenkit: Message[] = historyWithNewMessage.map((msg: StoredMessage) => ({
    role: msg.role as 'user' | 'model',
    content: [{ text: msg.content }],
  }));
  
  const aiInput: MultilingualChatInput = {
    messages: historyForGenkit,
    persona: activeCocotalk?.persona,
    rules: activeCocotalk?.instructions,
    model: model,
  };

  const result = await multilingualChat(aiInput);

  return result;
}
