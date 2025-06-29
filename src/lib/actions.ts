
'use server';

import {
  multilingualChat,
  type MultilingualChatInput,
} from '@/ai/flows/multilingual-chat';
import type { StoredMessage } from './types';
import type { AvailableModel } from '@/contexts/model-context';

interface InvokeAiChatInput {
  historyWithNewMessage: StoredMessage[];
  model: AvailableModel;
}

// This is the format the UI components expect
interface UICompatibleOutput {
    response?: string;
    error?: string;
}

export async function invokeAiChat(
  input: InvokeAiChatInput
): Promise<UICompatibleOutput> {
  const { historyWithNewMessage, model } = input;

  const messagesForFlow: MultilingualChatInput['messages'] = historyWithNewMessage.map(
    (msg: StoredMessage) => ({
      role: msg.role,
      content: msg.content,
    })
  );

  const aiInput: MultilingualChatInput = {
    messages: messagesForFlow,
    model: model,
    language: 'the same language as the user', // Let the AI adapt
  };

  const result = await multilingualChat(aiInput);

  // Adapt the flow's output to the format expected by the UI
  if (result.success) {
    return { response: result.response };
  } else {
    return { error: result.error };
  }
}
