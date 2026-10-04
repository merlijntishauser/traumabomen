import { PenLine } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeLayout } from "../hooks/useTreeLayout";
import { uuidToCompact } from "../lib/compactId";
import {
  buildSilhouette,
  SILHOUETTE_NODE,
  type Silhouette,
  type SilhouettePerson,
} from "../lib/treeSilhouette";
import { TreeRowMenu } from "./TreeRowMenu";
import { ContourDecoration } from "./tree/ContourDecoration";

// Matches the canvas node: 13.5px names in a 180-unit node hold about 20 characters.
const NAME_LIMIT = 20;

function shortName(name: string): string {
  return name.length > NAME_LIMIT ? `${name.slice(0, NAME_LIMIT - 1).trimEnd()}…` : name;
}

/** The latest tree as it sits on the canvas, in miniature. Decorative: the link around it names it. */
function TreeSilhouette({ silhouette }: { silhouette: Silhouette }) {
  const { x, y, width, height } = silhouette.viewBox;
  return (
    <svg
      className="tree-band__svg"
      viewBox={`${x} ${y} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {silhouette.links.map((link) => (
        <path
          key={link.key}
          d={link.d}
          className={`tree-band__link tree-band__link--${link.kind}`}
        />
      ))}
      {silhouette.people.map((p) => (
        <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
          <rect
            className="tree-band__node"
            width={SILHOUETTE_NODE.width}
            height={SILHOUETTE_NODE.height}
            rx={12}
          />
          <rect className="tree-band__node-top" width={SILHOUETTE_NODE.width} height={5} rx={2.5} />
          <text className="tree-band__node-name" x={14} y={46}>
            {shortName(p.name)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** A tree with nobody in it yet: one dashed place for the first person. */
function EmptySilhouette() {
  const { t } = useTranslation();
  return (
    <div className="tree-band__empty">
      <span className="tree-band__empty-node">{t("tree.startWithYourself")}</span>
    </div>
  );
}

function useLatestTreeSilhouette(treeId: string): { silhouette: Silhouette; isLoading: boolean } {
  const data = useTreeData(treeId);
  const { nodes } = useTreeLayout(
    data.persons,
    data.relationships,
    data.events,
    null,
    data.lifeEvents,
    undefined,
    data.classifications,
    data.turningPoints,
    data.siblingGroups,
  );
  const silhouette = useMemo(() => {
    const people: SilhouettePerson[] = nodes.flatMap((node) => {
      const person = data.persons.get(node.id);
      return person
        ? [{ id: node.id, name: person.name, x: node.position.x, y: node.position.y }]
        : [];
    });
    return buildSilhouette(people, Array.from(data.relationships.values()));
  }, [nodes, data.persons, data.relationships]);
  return { silhouette, isLoading: data.isLoading };
}

export interface LatestTree {
  id: string;
  name: string;
  is_demo: boolean;
  person_count: number;
}

interface LatestTreeBandProps {
  tree: LatestTree;
  metaLine: string;
  prompt: string;
  onRename: () => void;
  onDelete: () => void;
  /** The rename form or delete confirm, shown in place of the name block. */
  children?: ReactNode;
}

/**
 * The tree list's threshold: the most recently tended tree drawn as it sits
 * on the canvas, beside its name, when it was last tended, one open question,
 * and the way back in.
 */
export function LatestTreeBand({
  tree,
  metaLine,
  prompt,
  onRename,
  onDelete,
  children,
}: LatestTreeBandProps) {
  const { t } = useTranslation();
  const treePath = `/trees/${uuidToCompact(tree.id)}`;
  const started = tree.person_count > 0;
  const { silhouette, isLoading } = useLatestTreeSilhouette(tree.id);

  let preview: ReactNode;
  if (!started) preview = <EmptySilhouette />;
  else if (isLoading || silhouette.people.length === 0) {
    preview = <span className="tree-band__loading">{t("common.loading")}</span>;
  } else preview = <TreeSilhouette silhouette={silhouette} />;

  return (
    <section className="tree-band" aria-labelledby="tree-band-name">
      <Link
        className="tree-band__preview"
        to={treePath}
        aria-label={t("treeList.openNamed", { name: tree.name })}
        tabIndex={-1}
      >
        <ContourDecoration />
        {preview}
      </Link>

      <div className="tree-band__text">
        {children || (
          <>
            <div className="tree-band__title-row">
              <h2 id="tree-band-name" className="tree-band__name">
                {tree.name}
              </h2>
              <TreeRowMenu treeName={tree.name} onRename={onRename} onDelete={onDelete} />
            </div>
            {tree.is_demo && <span className="tree-list-item__demo-badge">{t("demo.badge")}</span>}
            <p className="tree-band__meta">{metaLine}</p>
          </>
        )}

        <p className="tree-band__question">{started ? prompt : t("treeList.firstPersonHint")}</p>

        <div className="tree-band__actions">
          <Link className="btn btn--primary tree-band__open" to={treePath}>
            {t("treeList.openTree")}
          </Link>
          {started && (
            <Link className="tree-band__write" to={`${treePath}/journal`}>
              <PenLine size={15} aria-hidden="true" />
              {t("treeList.writeAboutIt")}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
