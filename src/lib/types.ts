
import type { Timestamp } from "firebase/firestore";

// Interface for messages passed to components (with ReactNode)
export interface DisplayMessage {
  id: string;
  role: "user" | "model";
  content: React.ReactNode;
  text_content?: string;
}

// Interface for messages stored in Firestore
export interface StoredMessage {
  id: string;
  role: "user" | "model";
  content: string;
  file?: {
      name: string;
      type: string;
  };
}

// Interface for conversations stored in Firestore
export interface StoredConversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: Timestamp;
  userId: string;
}

// Interface for conversations passed to components
export interface DisplayConversation {
  id: string;
  title: string;
  messages: DisplayMessage[];
}
