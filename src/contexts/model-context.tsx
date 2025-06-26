'use client';

import * as React from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';

// List of available models, curated for multimodal capabilities to ensure app stability
export const AVAILABLE_MODELS = [
  'googleai/gemini-2.0-flash',
  'googleai/gemini-1.5-flash-latest',
  'googleai/gemini-1.5-pro-latest',
] as const;

export type AvailableModel = typeof AVAILABLE_MODELS[number];

interface ModelContextType {
  model: AvailableModel;
  setModel: (model: AvailableModel) => void;
}

const ModelContext = React.createContext<ModelContextType | undefined>(undefined);

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = useLocalStorage<AvailableModel>(
    'selected-ai-model',
    'googleai/gemini-2.0-flash'
  );

  const value = { model, setModel };

  return (
    <ModelContext.Provider value={value}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const context = React.useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}
