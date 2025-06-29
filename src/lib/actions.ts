'use server';

import {
  multilingualChat,
  type MultilingualChatInput,
  type MultilingualChatOutput,
} from '@/ai/flows/multilingual-chat';
import type { StoredCocotalk, StoredMessage } from './types';
import type { AvailableModel } from '@/contexts/model-context';
import type { MultilingualChatInput as ChatInputType } from '@/ai/flows/multilingual-chat';

interface InvokeAiChatInput {
  historyWithNewMessage: StoredMessage[];
  model: AvailableModel;
  activeCocotalk: StoredCocotalk | null;
}

export async function invokeAiChat(
  input: InvokeAiChatInput
): Promise<MultilingualChatOutput> {
  const { historyWithNewMessage, model, activeCocotalk } = input;

  // The multilingualChat flow expects a simple array of {role, content: string},
  // not the complex Genkit Message object. The flow itself is responsible
  // for converting to the Genkit format. This corrects the schema mismatch.
  const messagesForFlow: ChatInputType['messages'] = historyWithNewMessage.map(
    (msg: StoredMessage) => ({
      role: msg.role,
      content: msg.content,
    })
  );

  const aiInput: MultilingualChatInput = {
    messages: messagesForFlow,
    persona: activeCocotalk?.persona,
    rules: activeCocotalk?.instructions,
    model: model,
  };

  const result = await multilingualChat(aiInput);

  return result;
}
