
'use server';

import {
  multilingualChat,
  type MultilingualChatInput,
  type MultilingualChatOutput,
} from '@/ai/flows/multilingual-chat';
import type { StoredMessage } from './types';
import type { AvailableModel } from '@/contexts/model-context';
import type { MultilingualChatInput as ChatInputType } from '@/ai/flows/multilingual-chat';

interface InvokeAiChatInput {
  historyWithNewMessage: StoredMessage[];
  model: AvailableModel;
}

export async function invokeAiChat(
  input: InvokeAiChatInput
): Promise<MultilingualChatOutput> {
  const { historyWithNewMessage, model } = input;

  const messagesForFlow: ChatInputType['messages'] = historyWithNewMessage.map(
    (msg: StoredMessage) => ({
      role: msg.role,
      content: msg.content,
    })
  );

  const aiInput: MultilingualChatInput = {
    messages: messagesForFlow,
    model: model,
  };

  const result = await multilingualChat(aiInput);

  return result;
}
