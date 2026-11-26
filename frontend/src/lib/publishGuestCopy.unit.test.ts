import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import demoFixtureEn from "../fixtures/demo-tree-en.json";
import { buildDemoState } from "./buildDemoState";
import type { DemoFixture } from "./createDemoTree";
import { encryptForApi, generateTreeKey } from "./crypto";
import { GuestCopyError, type GuestCopyInput, parseGuestCopy } from "./guestCopy";
import { decryptGuestCopy, deriveGuestKeys, generateLinkSecret } from "./guestCrypto";
import {
  fetchGuestCopyInput,
  GuestCopyLoadError,
  GuestCopyTooLargeError,
  publishGuestCopy,
} from "./publishGuestCopy";

const api = vi.hoisted(() => ({
  getTree: vi.fn(),
  getPersons: vi.fn(),
  getRelationships: vi.fn(),
  getEvents: vi.fn(),
  getLifeEvents: vi.fn(),
  getTurningPoints: vi.fn(),
  getClassifications: vi.fn(),
  getPatterns: vi.fn(),
  getSiblingGroups: vi.fn(),
  getJournalEntries: vi.fn(),
}));
vi.mock("./api", () => api);

/** The argon2-browser bundle, run in its own context (see guestCrypto.unit.test.ts). */
function loadArgon2(): unknown {
  const source = readFileSync(resolve(process.cwd(), "public/argon2-bundled.min.js"), "utf8");
  const context = vm.createContext({ WebAssembly, TextEncoder, TextDecoder, atob, console });
  context.self = context;
  new vm.Script(source, { filename: "argon2-bundled.min.js" }).runInContext(context);
  return context.argon2;
}

const NOW = new Date("2026-11-26T12:00:00.000Z");
const PASSPHRASE = "maple river quiet lantern stone";
const JOURNAL_TEXT = "a private journal reflection";

let treeKey: CryptoKey;
let treeKeyBase64: string;

function demoState(): GuestCopyInput {
  return buildDemoState(demoFixtureEn as DemoFixture);
}

async function encrypted<T extends { id: string }>(items: Map<string, T>) {
  return Promise.all(
    Array.from(items.values()).map(async (item) => ({
      ...("person_ids" in item ? { person_ids: item.person_ids } : {}),
      ...("source_person_id" in item
        ? { source_person_id: item.source_person_id, target_person_id: item.target_person_id }
        : {}),
      id: item.id,
      encrypted_data: await encryptForApi(item, treeKey),
    })),
  );
}

/** Serve the demo tree from the mocked API, encrypted under the tree key. */
async function serveTree(state: GuestCopyInput) {
  api.getTree.mockResolvedValue({
    id: "tree-1",
    encrypted_data: await encryptForApi({ name: state.treeName }, treeKey),
  });
  api.getPersons.mockResolvedValue(await encrypted(state.persons));
  api.getRelationships.mockResolvedValue(await encrypted(state.relationships));
  api.getEvents.mockResolvedValue(await encrypted(state.events));
  api.getLifeEvents.mockResolvedValue(await encrypted(state.lifeEvents));
  api.getTurningPoints.mockResolvedValue(await encrypted(state.turningPoints));
  api.getClassifications.mockResolvedValue(await encrypted(state.classifications));
  api.getPatterns.mockResolvedValue(await encrypted(state.patterns));
  api.getSiblingGroups.mockResolvedValue(await encrypted(state.siblingGroups));
  api.getJournalEntries.mockResolvedValue([
    { id: "j1", encrypted_data: await encryptForApi({ text: JOURNAL_TEXT }, treeKey) },
  ]);
}

function publish(linkSecret: string, fetchAll = fetchGuestCopyInput) {
  return publishGuestCopy({
    treeId: "tree-1",
    treeKey,
    linkSecret,
    passphrase: PASSPHRASE,
    language: "en",
    fetchAll,
    now: NOW,
  });
}

beforeAll(async () => {
  vi.stubGlobal("self", { argon2: loadArgon2() });
  const generated = await generateTreeKey();
  treeKey = generated.key;
  treeKeyBase64 = generated.base64;
});

beforeEach(async () => {
  for (const fn of Object.values(api)) fn.mockReset();
  await serveTree(demoState());
});

describe("publishGuestCopy", () => {
  it("encrypts a copy the guest side opens, without the journal or the tree key", async () => {
    const linkSecret = generateLinkSecret();
    const out = await publish(linkSecret);

    const guest = await deriveGuestKeys(linkSecret, PASSPHRASE);
    expect(out.linkId).toBe(guest.linkId);
    expect(out.token).toBe(guest.token);
    const plaintext = await decryptGuestCopy(out.ciphertext, guest.encKey, guest.linkId);

    const copy = parseGuestCopy(JSON.parse(plaintext));
    const state = demoState();
    expect(copy.treeName).toBe(state.treeName);
    expect(copy.persons).toHaveLength(state.persons.size);
    expect(copy.patterns).toHaveLength(state.patterns.size);
    expect(copy.publishedAt).toBe(NOW.toISOString());

    expect(api.getJournalEntries).not.toHaveBeenCalled();
    expect(plaintext).not.toContain(JOURNAL_TEXT);
    expect(plaintext.toLowerCase()).not.toContain("journal");
    expect(plaintext).not.toContain(treeKeyBase64);
  }, 30000);

  it("rejects with a load error when one item fails to decrypt", async () => {
    const persons = await api.getPersons();
    api.getPersons.mockResolvedValue([...persons, { id: "broken", encrypted_data: "not-a-blob" }]);
    await expect(publish(generateLinkSecret())).rejects.toBeInstanceOf(GuestCopyLoadError);
  });

  it("rejects with a load error when a fetch fails", async () => {
    api.getPatterns.mockRejectedValue(new Error("network"));
    await expect(publish(generateLinkSecret())).rejects.toBeInstanceOf(GuestCopyLoadError);
  });

  it("refuses a copy the guest page could not open, before deriving any key", async () => {
    const state = demoState();
    const [first] = state.persons.values();
    state.persons.set(first.id, { ...first, birth_year: 99999 });
    const argon = vi.fn();
    vi.stubGlobal("self", { argon2: { ArgonType: { Argon2id: 2 }, hash: argon } });
    try {
      await expect(publish(generateLinkSecret(), async () => state)).rejects.toBeInstanceOf(
        GuestCopyError,
      );
      expect(argon).not.toHaveBeenCalled();
    } finally {
      vi.stubGlobal("self", { argon2: loadArgon2() });
    }
  });

  it("throws the too-large error for a 6 MB copy", async () => {
    const state = demoState();
    const people = Array.from(state.persons.values());
    for (let i = 0; i < 400; i++) {
      const base = people[i % people.length];
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      state.persons.set(id, { ...base, id, notes: "x".repeat(15_000) });
    }
    await expect(publish(generateLinkSecret(), async () => state)).rejects.toBeInstanceOf(
      GuestCopyTooLargeError,
    );
  }, 30000);
});
