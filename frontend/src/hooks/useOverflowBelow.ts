import { useCallback, useEffect, useState } from "react";

function hasMoreBelow(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight > 2;
}

/**
 * Whether a scroll container has content below what is visible, kept current
 * on scroll, resize, and content changes. Returns a callback ref, the flag,
 * and a scroll handler to attach.
 */
export function useOverflowBelow<T extends HTMLElement>(): [
  (el: T | null) => void,
  boolean,
  () => void,
] {
  const [element, setElement] = useState<T | null>(null);
  const [more, setMore] = useState(false);
  const ref = useCallback((el: T | null) => setElement(el), []);
  const onScroll = useCallback(() => {
    if (element) setMore(hasMoreBelow(element));
  }, [element]);
  useEffect(() => {
    if (!element) return;
    const measure = () => setMore(hasMoreBelow(element));
    measure();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resize?.observe(element);
    const mutation = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    mutation?.observe(element, { childList: true, subtree: true, characterData: true });
    return () => {
      resize?.disconnect();
      mutation?.disconnect();
    };
  }, [element]);
  return [ref, more, onScroll];
}
