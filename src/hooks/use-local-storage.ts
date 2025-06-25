"use client";

import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    // Cet effet ne s'exécute que côté client, après le rendu initial, pour éviter les erreurs d'hydratation.
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Erreur de lecture de la clé localStorage “${key}”:`, error);
    }
  }, [key]);

  const setValueAndStore = useCallback((newValue: React.SetStateAction<T>) => {
    setValue(prevValue => {
      // Permet à la nouvelle valeur d'être une fonction pour avoir la même API que useState
      const valueToStore = newValue instanceof Function ? newValue(prevValue) : newValue;
      try {
        // Sauvegarde dans le localStorage
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.warn(`Erreur d'écriture de la clé localStorage “${key}”:`, error);
      }
      return valueToStore;
    });
  }, [key]);

  return [value, setValueAndStore];
}
