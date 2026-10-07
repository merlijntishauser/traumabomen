import { useCallback, useEffect, useState } from "react";

/**
 * The live content width of an element, following resizes. Returns a callback
 * ref to attach, the element itself (for scrolling), and its width (0 until measured).
 */
export function useElementWidth<T extends HTMLElement>(): [
  (el: T | null) => void,
  T | null,
  number,
] {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: T | null) => setElement(el), []);
  useEffect(() => {
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [ref, element, width];
}
