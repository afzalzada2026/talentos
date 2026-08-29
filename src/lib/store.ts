import { useEffect, useState } from "react";

/** JSON-backed localStorage state. Data never leaves the browser except calls to Groq. */
export function useLocalStorage<T>(key: string, initial: T | (() => T)) {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch {
      /* corrupted or unavailable storage — fall through */
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* storage full or blocked — state still works in memory */
    }
  }, [key, val]);

  return [val, setVal] as const;
}
