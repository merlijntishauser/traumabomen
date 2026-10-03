import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { useEncryption } from "../contexts/useEncryption";
import { createTree, deleteTree, modifyKeyRing, updateTree } from "../lib/api";
import { uuidToCompact } from "../lib/compactId";
import { createDemoTree } from "../lib/createDemoTree";
import { encryptForApi, generateTreeKey } from "../lib/crypto";

interface Callbacks {
  /** A new tree was created (the hook then navigates to it). */
  onCreated: () => void;
  /** A rename was saved. */
  onRenamed: () => void;
  /** A tree was deleted. */
  onDeleted: () => void;
}

/**
 * The tree list's server mutations: create, create demo, rename, delete.
 * Each new tree gets its own key, stored in the encrypted key ring before
 * the user is taken to it.
 *
 * Also honours `?start=demo` from the onboarding gate's "Start with the demo
 * tree": the demo is created once and the param dropped, so a reload or the
 * back button does not create a second one.
 */
export function useTreeListMutations({ onCreated, onRenamed, onDeleted }: Callbacks) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { encrypt, masterKey, addTreeKey, removeTreeKey } = useEncryption();

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { key: treeKey, base64: treeKeyBase64 } = await generateTreeKey();
      const encrypted_data = await encryptForApi({ name }, treeKey);
      const response = await createTree({ encrypted_data });
      addTreeKey(response.id, treeKey, treeKeyBase64);
      await modifyKeyRing(masterKey!, (entries) => ({
        ...entries,
        [response.id]: treeKeyBase64,
      }));
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      onCreated();
      navigate(`/trees/${uuidToCompact(response.id)}`);
    },
  });

  const demoMutation = useMutation({
    mutationFn: async () => {
      const { key: treeKey, base64: treeKeyBase64 } = await generateTreeKey();
      const boundEncrypt = (data: unknown) => encryptForApi(data, treeKey);
      const treeId = await createDemoTree(boundEncrypt, i18n.language);
      addTreeKey(treeId, treeKey, treeKeyBase64);
      await modifyKeyRing(masterKey!, (entries) => ({
        ...entries,
        [treeId]: treeKeyBase64,
      }));
      return treeId;
    },
    onSuccess: (treeId) => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      navigate(`/trees/${uuidToCompact(treeId)}`);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const encrypted_data = await encrypt({ name }, id);
      return updateTree(id, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      onRenamed();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteTree(id);
      removeTreeKey(id);
      await modifyKeyRing(masterKey!, (entries) => {
        const updated = { ...entries };
        delete updated[id];
        return updated;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      onDeleted();
    },
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const demoStartedRef = useRef(false);
  const startDemo = searchParams.get("start") === "demo";
  const { mutate: createDemo } = demoMutation;
  useEffect(() => {
    if (!startDemo || !masterKey || demoStartedRef.current) return;
    demoStartedRef.current = true;
    setSearchParams({}, { replace: true });
    createDemo();
  }, [startDemo, masterKey, setSearchParams, createDemo]);

  return { createMutation, demoMutation, renameMutation, deleteMutation };
}
