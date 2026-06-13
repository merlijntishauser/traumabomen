import { BookOpen, LayoutGrid, Undo2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import { PatternFocusMenu } from "./PatternFocusMenu";

interface CanvasToolbarButtonsProps {
  onAddPerson: () => void;
  isAddingPerson: boolean;
  onAutoLayout: () => void;
  hasLayout: boolean;
  onUndo: () => void;
  canUndo: boolean;
  patterns: Map<string, DecryptedPattern>;
  focusedPatternId: string | null;
  onFocusPattern: (id: string | null) => void;
  onManagePatterns: () => void;
  journalPanelOpen: boolean;
  onToggleJournal: () => void;
}

export function CanvasToolbarButtons({
  onAddPerson,
  isAddingPerson,
  onAutoLayout,
  hasLayout,
  onUndo,
  canUndo,
  patterns,
  focusedPatternId,
  onFocusPattern,
  onManagePatterns,
  journalPanelOpen,
  onToggleJournal,
}: CanvasToolbarButtonsProps) {
  const { t } = useTranslation();

  return (
    <>
      <button
        type="button"
        className="tree-toolbar__icon-btn"
        onClick={onAddPerson}
        disabled={isAddingPerson}
        aria-label={t("tree.addPerson")}
      >
        <UserPlus size={14} />
      </button>
      <div className="tree-toolbar__btn-group">
        <button
          type="button"
          className="tree-toolbar__icon-btn"
          onClick={onAutoLayout}
          disabled={!hasLayout}
          aria-label={t("tree.autoLayout")}
        >
          <LayoutGrid size={14} />
        </button>
        <button
          type="button"
          className="tree-toolbar__icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t("tree.undo")}
        >
          <Undo2 size={14} />
        </button>
      </div>
      <PatternFocusMenu
        patterns={patterns}
        focusedPatternId={focusedPatternId}
        onFocus={onFocusPattern}
        onManage={onManagePatterns}
      />
      <button
        type="button"
        className={`tree-toolbar__icon-btn${journalPanelOpen ? " tree-toolbar__icon-btn--active" : ""}`}
        onClick={onToggleJournal}
        aria-label={t("journal.tab")}
      >
        <BookOpen size={14} />
      </button>
    </>
  );
}
