import { useCallback, useState } from "react";
import type { PersonDetailSection } from "../components/tree/PersonDetailPanel";
import type { JournalLinkedRef } from "../types/domain";

export interface WorkspacePanelState {
  selectedPersonId: string | null;
  setSelectedPersonId: (id: string | null) => void;
  patternPanelOpen: boolean;
  setPatternPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  // How the pattern panel opens: `creating` starts in the new-pattern form, and
  // each request bumps `nonce` so an already open panel remounts to honour it.
  patternPanelStart: { creating: boolean; nonce: number };
  openPatternPanel: (creating: boolean) => void;
  journalPanelOpen: boolean;
  setJournalPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  journalInitialPrompt: string;
  journalInitialLinkedRef: JournalLinkedRef | undefined;
  openJournal: (prompt: string, linkedRef?: JournalLinkedRef) => void;
  hoveredPatternId: string | null;
  setHoveredPatternId: (id: string | null) => void;
  initialSection: PersonDetailSection;
  setInitialSection: (section: PersonDetailSection) => void;
}

export function useWorkspacePanels(options?: {
  initialPatternPanelOpen?: boolean;
  initialPatternCreating?: boolean;
}): WorkspacePanelState {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [patternPanelOpen, setPatternPanelOpen] = useState(
    (options?.initialPatternPanelOpen || options?.initialPatternCreating) ?? false,
  );
  const [patternPanelStart, setPatternPanelStart] = useState(() => ({
    creating: options?.initialPatternCreating ?? false,
    nonce: 0,
  }));
  const [journalPanelOpen, setJournalPanelOpen] = useState(false);
  const [journalInitialPrompt, setJournalInitialPrompt] = useState("");
  const [journalInitialLinkedRef, setJournalInitialLinkedRef] = useState<
    JournalLinkedRef | undefined
  >(undefined);
  const [hoveredPatternId, setHoveredPatternId] = useState<string | null>(null);
  const [initialSection, setInitialSection] = useState<PersonDetailSection>(null);

  const openJournal = useCallback((prompt: string, linkedRef?: JournalLinkedRef) => {
    setJournalInitialPrompt(prompt);
    setJournalInitialLinkedRef(linkedRef);
    setJournalPanelOpen(true);
  }, []);

  const openPatternPanel = useCallback((creating: boolean) => {
    setPatternPanelStart((prev) => ({ creating, nonce: prev.nonce + 1 }));
    setPatternPanelOpen(true);
  }, []);

  return {
    selectedPersonId,
    setSelectedPersonId,
    patternPanelOpen,
    setPatternPanelOpen,
    patternPanelStart,
    openPatternPanel,
    journalPanelOpen,
    setJournalPanelOpen,
    journalInitialPrompt,
    journalInitialLinkedRef,
    openJournal,
    hoveredPatternId,
    setHoveredPatternId,
    initialSection,
    setInitialSection,
  };
}
