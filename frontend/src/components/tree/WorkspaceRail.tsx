import { BookOpen, LayoutGrid, Undo2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import { PatternFocusMenu } from "./PatternFocusMenu";
import "./WorkspaceRail.css";

interface WorkspaceRailProps {
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

/**
 * The canvas tools, in one quiet rail along the left edge of the workspace:
 * building the tree first, then the reflective tools. Labels show as tooltips
 * to the right; on narrow screens the rail runs along the bottom instead.
 */
export function WorkspaceRail({
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
}: WorkspaceRailProps) {
  const { t } = useTranslation();

  return (
    <nav className="workspace-rail" aria-label={t("tree.tools")}>
      <div className="workspace-rail__group">
        <button
          type="button"
          className="workspace-rail__btn"
          onClick={onAddPerson}
          disabled={isAddingPerson}
          aria-label={t("tree.addPerson")}
        >
          <UserPlus size={18} />
        </button>
        <button
          type="button"
          className="workspace-rail__btn"
          onClick={onAutoLayout}
          disabled={!hasLayout}
          aria-label={t("tree.autoLayout")}
        >
          <LayoutGrid size={18} />
        </button>
        <button
          type="button"
          className="workspace-rail__btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t("tree.undo")}
        >
          <Undo2 size={18} />
        </button>
      </div>
      <div className="workspace-rail__group">
        <PatternFocusMenu
          patterns={patterns}
          focusedPatternId={focusedPatternId}
          onFocus={onFocusPattern}
          onManage={onManagePatterns}
          triggerClassName="workspace-rail__btn"
          iconSize={18}
          placement="side"
        />
        <button
          type="button"
          className="workspace-rail__btn"
          onClick={onToggleJournal}
          aria-pressed={journalPanelOpen}
          aria-label={t("journal.tab")}
        >
          <BookOpen size={18} />
        </button>
      </div>
    </nav>
  );
}
