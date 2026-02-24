import { useCallback, useState } from "react";

export function useLocalStorageSettings<T extends object>(
  key: string,
  defaults: T,
): { settings: T; update: (partial: Partial<T>) => void } {
  const [settings, setSettings] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  });

  const update = useCallback(
    (partial: Partial<T>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key],
  );

  return { settings, update };
}
