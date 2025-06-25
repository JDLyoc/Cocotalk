"use client";

import { useState, useEffect, useRef } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState(defaultValue);
  const isInitialMount = useRef(true);

  // Effect to read from localStorage on mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setValue(JSON.parse(item));
      }
    } catch (error) {
      console.error("Error reading localStorage key “" + key + "”:", error);
    }
  }, [key]);

  // Effect to write to localStorage on value change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error setting localStorage key “" + key + "”:", error);
    }
  }, [key, value]);

  return [value, setValue];
}
