'use server';

import {
  multilingualChat,
  type MultilingualChatInput,
  type MultilingualChatOutput,
} from '@/ai/flows/multilingual-chat';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Message } from 'genkit';
import type { StoredConversation, StoredCocotalk, StoredMessage } from './types';
import type { AvailableModel } from '@/contexts/model-context';

interface InvokeAiChatInput {
  conversationId: string | null;
  messageContent: string;
  model: AvailableModel;
  activeCocotalk: StoredCocotalk | null;
  userId: string;
}

export async function invokeAiChat(
  input: InvokeAiChatInput
): Promise<MultilingualChatOutput> {
  const { conversationId, messageContent, model, activeCocotalk, userId } = input;

  let historyForGenkit: Message[] = [];

  if (conversationId) {
    const convRef = doc(db, 'users', userId, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);

    if (convSnap.exists()) {
      const conversationData = convSnap.data() as StoredConversation;
      historyForGenkit = conversationData.messages.map((msg: StoredMessage) => ({
        role: msg.role,
        content: msg.content,
      }));
    } else {
      console.error(`Conversation with ID ${conversationId} not found for user ${userId}.`);
      return { error: 'Conversation non trouvée. Impossible de continuer.' };
    }
  }

  historyForGenkit.push({ role: 'user', content: messageContent });

  const aiInput: MultilingualChatInput = {
    messages: historyForGenkit,
    persona: activeCocotalk?.persona,
    rules: activeCocotalk?.instructions,
    model: model,
  };

  const result = await multilingualChat(aiInput);

  return result;
}
