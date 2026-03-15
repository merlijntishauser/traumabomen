import "@testing-library/jest-dom/vitest";

// Suppress Node 25 warning about --localstorage-file when jsdom sets globalThis.localStorage
const _origEmit = process.emit.bind(process) as typeof process.emit;
process.emit = function (this: NodeJS.Process, event: string, ...args: unknown[]) {
  if (
    event === "warning" &&
    args[0] instanceof Error &&
    args[0].message.includes("localstorage-file")
  ) {
    return false;
  }
  return _origEmit.call(this, event, ...(args as Parameters<typeof _origEmit>));
} as typeof process.emit;
