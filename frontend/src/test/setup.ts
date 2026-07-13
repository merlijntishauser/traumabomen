import "@testing-library/jest-dom/vitest";

// jsdom does not implement the <dialog> modal methods (showModal/show/close).
// Stub them so components using native <dialog> can render under test.
const dialogProto = globalThis.HTMLDialogElement?.prototype;
if (dialogProto && !dialogProto.showModal) {
  dialogProto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  dialogProto.show = function show(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  dialogProto.close = function close(this: HTMLDialogElement, returnValue?: string) {
    this.removeAttribute("open");
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom does not implement <canvas> rendering; its getContext() returns null
// and logs "not implemented" noise for every hero that mounts AmbientBackground.
// Those components already guard the null context (ctx?.), so override
// getContext to return null quietly, matching that behaviour without the log.
// Tests that assert on canvas drawing spy on getContext themselves.
const canvasProto = globalThis.HTMLCanvasElement?.prototype;
if (canvasProto) {
  canvasProto.getContext = (() => null) as HTMLCanvasElement["getContext"];
}

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
