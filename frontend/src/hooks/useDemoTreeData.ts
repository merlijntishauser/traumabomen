import { useEffect, useMemo, useState } from "react";
import { buildDemoState, type DemoTreeState } from "../lib/buildDemoState";
import type { DemoFixture } from "../lib/createDemoTree";

/**
 * Load the language-matched demo fixture (lazy-imported, like createDemoTree)
 * and turn it into the in-memory entity maps the read-only demo renders from.
 * Returns null until the fixture has loaded. No API, no encryption.
 */
export function useDemoTreeData(language: string): DemoTreeState | null {
  const isNl = language.startsWith("nl");
  const [fixture, setFixture] = useState<DemoFixture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = isNl
      ? import("../fixtures/demo-tree-nl.json")
      : import("../fixtures/demo-tree-en.json");
    load.then((module) => {
      if (!cancelled) setFixture(module.default as DemoFixture);
    });
    return () => {
      cancelled = true;
    };
  }, [isNl]);

  return useMemo(() => (fixture ? buildDemoState(fixture) : null), [fixture]);
}
