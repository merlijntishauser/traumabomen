import { useCallback, useRef, useState } from "react";

export type PositionSnapshot = Map<string, { x: number; y: number } | undefined>;

const MAX_STACK_SIZE = 20;

export function usePositionHistory() {
  const stackRef = useRef<PositionSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const push = useCallback((snapshot: PositionSnapshot) => {
    stackRef.current = [...stackRef.current.slice(-(MAX_STACK_SIZE - 1)), snapshot];
    setCanUndo(true);
  }, []);

  const pop = useCallback((): PositionSnapshot | undefined => {
    const stack = stackRef.current;
    if (stack.length === 0) return undefined;
    const top = stack[stack.length - 1];
    stackRef.current = stack.slice(0, -1);
    setCanUndo(stack.length > 1);
    return top;
  }, []);

  return { canUndo, push, pop } as const;
}
