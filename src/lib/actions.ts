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

// This server action is now more robust. It fetches conversation history
// itself, preventing the client from sending a tampered or out-of-sync history.
export async function invokeAiChat(
  input: InvokeAiChatInput
): Promise<MultilingualChatOutput> {
  const { conversationId, messageContent, model, activeCocotalk, userId } = input;

  try {
    let historyForGenkit: Message[] = [];

    // If a conversationId is provided, securely fetch its history from Firestore.
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

    // Add the new user message to the history.
    historyForGenkit.push({ role: 'user', content: messageContent });

    const aiInput: MultilingualChatInput = {
      messages: historyForGenkit,
      persona: activeCocotalk?.persona,
      rules: activeCocotalk?.instructions,
      model: model,
    };

    // The Genkit flow now handles its own internal errors and returns a structured response.
    const result = await multilingualChat(aiInput);

    return result;
  } catch (error: any) {
    console.error('Critical error in invokeAiChat server action:', error);
    // This catch block is for unexpected, catastrophic errors, not regular AI errors
    // which are handled gracefully inside the Genkit flow itself.
    return {
      error: `Une erreur critique et inattendue est survenue: ${error.message}`,
    };
  }
}
