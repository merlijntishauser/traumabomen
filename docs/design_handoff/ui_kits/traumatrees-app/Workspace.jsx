/* Workspace — the canvas + toolbar + side panel. The dense product surface. */

function Workspace() {
  const [view, setView] = React.useState("tree");
  const [selectedId, setSelectedId] = React.useState("margriet");

  return (
    <div className="ws">
      <style>{`
        .ws { height: 100vh; display: flex; flex-direction: column; background: var(--color-bg-primary); color: var(--color-text-primary); font-family: var(--font-body); }
        .ws__bar {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 18px;
          border-bottom: 1px solid var(--color-border-secondary);
          background: var(--color-bg-primary);
          flex-shrink: 0;
        }
        .ws__title { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-heading); font-weight: 300; font-size: 17px; }
        .ws__divider { width: 1px; height: 18px; background: var(--color-border-secondary); }
        .ws__seg { display: flex; gap: 2px; padding: 2px; background: var(--color-bg-tertiary); border-radius: var(--radius-sm); }
        .ws__seg-btn {
          font-family: var(--font-body); font-weight: 600; font-size: 13px;
          padding: 6px 12px; background: transparent; color: var(--color-text-muted);
          border: none; border-radius: 4px; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
          transition: var(--transition-colors);
        }
        .ws__seg-btn.is-active { background: var(--color-bg-secondary); color: var(--color-text-primary); }
        .ws__bar-right { margin-left: auto; display: inline-flex; align-items: center; gap: 10px; }
        .ws__saved { font-size: 12px; color: var(--color-text-muted); display: inline-flex; align-items: center; gap: 6px; }

        .ws__body { flex: 1; display: flex; min-height: 0; }
        .ws__canvas {
          flex: 1; position: relative; overflow: hidden;
          background:
            radial-gradient(ellipse at 20% 90%, var(--color-accent-subtle), transparent 60%),
            var(--color-bg-canvas);
        }
        .ws__canvas::before {
          content: ""; position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 18px 18px;
          pointer-events: none;
        }
        .ws__nodes { position: relative; width: 100%; height: 100%; padding: 36px; }

        .ws__node {
          position: absolute;
          width: 180px; padding: 12px 14px;
          background: var(--color-node-bg);
          border: 1px solid var(--color-node-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
          cursor: pointer;
        }
        .ws__node.is-selected { border-color: var(--color-node-selected); box-shadow: 0 0 0 2px var(--color-accent-focus-ring), var(--shadow-md); }
        .ws__node-row { display: flex; gap: 10px; align-items: center; }
        .ws__avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--color-bg-tertiary);
          border: 1px solid var(--color-border-primary);
          color: var(--color-text-secondary);
          display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-heading); font-weight: 300; font-size: 13px;
          flex-shrink: 0;
        }
        .ws__node-name { font-family: var(--font-heading); font-weight: 300; font-size: 14px; color: var(--color-text-primary); line-height: 1.2; }
        .ws__node-meta { font-size: 10px; color: var(--color-text-muted); margin-top: 1px; }
        .ws__node-chips { margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap; }

        .ws__edge { position: absolute; top: 0; left: 0; pointer-events: none; }

        .ws__panel {
          width: 320px; flex-shrink: 0;
          border-left: 1px solid var(--color-border-secondary);
          background: var(--color-bg-secondary);
          padding: 24px;
          display: flex; flex-direction: column; gap: 16px;
          overflow-y: auto;
        }
        .ws__panel-h { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .ws__panel-name { font-family: var(--font-heading); font-weight: 200; font-size: 1.6rem; line-height: 1.2; }
        .ws__panel-meta { font-size: 12px; color: var(--color-text-muted); margin-top: 4px; }
        .ws__panel-prose { font-family: var(--font-body); font-size: 14px; line-height: 1.55; color: var(--color-text-secondary); }
        .ws__linked-row {
          font-size: 13px; color: var(--color-text-primary);
          padding: 8px 10px; background: var(--color-bg-tertiary); border-radius: var(--radius-sm);
          display: flex; justify-content: space-between; align-items: center;
        }
        .ws__linked-rel { font-size: 11px; color: var(--color-text-muted); }
        .ws__footer {
          flex-shrink: 0;
          padding: 8px 18px;
          border-top: 1px solid var(--color-border-secondary);
          font-size: 11px; color: var(--color-text-muted);
          display: flex; align-items: center; gap: 12px;
        }
        .ws__footer-heart { color: var(--color-edge-partner); display: inline-flex; }
      `}</style>

      <header className="ws__bar">
        <div className="ws__title">
          <IconLeaf size={18} style={{ color: "var(--color-accent)" }} />
          My family
        </div>
        <div className="ws__divider" />
        <div className="ws__seg">
          <button className={`ws__seg-btn ${view === "tree" ? "is-active" : ""}`} onClick={() => setView("tree")}>
            <IconTreeView size={14} /> Tree
          </button>
          <button className={`ws__seg-btn ${view === "timeline" ? "is-active" : ""}`} onClick={() => setView("timeline")}>
            <IconTimeline size={14} /> Timeline
          </button>
          <button className={`ws__seg-btn ${view === "patterns" ? "is-active" : ""}`} onClick={() => setView("patterns")}>
            <IconPatterns size={14} /> Patterns
          </button>
        </div>
        <div className="ws__bar-right">
          <span className="ws__saved"><IconLock size={12} /> Auto-saved · 12s</span>
          <Button variant="secondary" size="sm" icon={<IconPlus size={13} />}>Add person</Button>
          <IconButton icon={<IconMessage size={15} />} label="Feedback" />
          <IconButton icon={<IconMoon size={15} />} label="Theme" />
          <IconButton icon={<IconLock size={15} />} label="Lock" />
        </div>
      </header>

      <div className="ws__body">
        <div className="ws__canvas">
          <div className="ws__nodes">
            <svg className="ws__edge" width="100%" height="100%">
              <line x1="220" y1="92" x2="320" y2="92" stroke="var(--color-edge-partner)" strokeWidth="2" />
              <line x1="270" y1="92" x2="270" y2="220" stroke="var(--color-edge-default)" strokeWidth="1.5" />
              <line x1="270" y1="220" x2="170" y2="260" stroke="var(--color-edge-default)" strokeWidth="1.5" />
              <line x1="270" y1="220" x2="370" y2="260" stroke="var(--color-edge-default)" strokeWidth="1.5" />
              <line x1="120" y1="92" x2="220" y2="92" stroke="var(--color-edge-half-sibling)" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>

            {/* Generation 1 */}
            <div className="ws__node" style={{ top: 60, left: 36 }}>
              <div className="ws__node-row">
                <div className="ws__avatar">K</div>
                <div>
                  <div className="ws__node-name">Karel</div>
                  <div className="ws__node-meta">1923 — 1998</div>
                </div>
              </div>
              <div className="ws__node-chips">
                <Badge tone="war">War</Badge>
              </div>
            </div>

            {/* Generation 2 */}
            <div
              className={`ws__node ${selectedId === "wim" ? "is-selected" : ""}`}
              style={{ top: 60, left: 220 }}
              onClick={() => setSelectedId("wim")}
            >
              <div className="ws__node-row">
                <div className="ws__avatar">WV</div>
                <div>
                  <div className="ws__node-name">Wim de Vries</div>
                  <div className="ws__node-meta">1948 — present</div>
                </div>
              </div>
              <div className="ws__node-chips">
                <Badge tone="addiction">Addiction</Badge>
              </div>
            </div>
            <div
              className={`ws__node ${selectedId === "margriet" ? "is-selected" : ""}`}
              style={{ top: 60, left: 410 }}
              onClick={() => setSelectedId("margriet")}
            >
              <div className="ws__node-row">
                <div className="ws__avatar">M</div>
                <div>
                  <div className="ws__node-name">Margriet</div>
                  <div className="ws__node-meta">1952 — 2019</div>
                </div>
              </div>
              <div className="ws__node-chips">
                <Badge tone="loss">Loss</Badge>
                <Badge tone="illness">Illness</Badge>
              </div>
            </div>

            {/* Generation 3 */}
            <div className="ws__node" style={{ top: 240, left: 130 }}>
              <div className="ws__node-row">
                <div className="ws__avatar">A</div>
                <div>
                  <div className="ws__node-name">Anna</div>
                  <div className="ws__node-meta">1978 — present</div>
                </div>
              </div>
              <div className="ws__node-chips">
                <Badge tone="cycle" dot={false}>Cycle-breaking</Badge>
              </div>
            </div>
            <div className="ws__node" style={{ top: 240, left: 330 }}>
              <div className="ws__node-row">
                <div className="ws__avatar">P</div>
                <div>
                  <div className="ws__node-name">Pieter</div>
                  <div className="ws__node-meta">1981 — present</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="ws__panel">
          <div className="ws__panel-h">
            <div>
              <Eyebrow>Person</Eyebrow>
              <div className="ws__panel-name">Margriet</div>
              <div className="ws__panel-meta">Born 1952, Den Haag · died 2019</div>
            </div>
            <IconButton icon={<IconClose size={14} />} label="Close panel" />
          </div>
          <div className="row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge tone="loss">Loss</Badge>
            <Badge tone="illness">Illness</Badge>
          </div>
          <Divider />
          <div>
            <Eyebrow style={{ marginBottom: 6 }}>Story</Eyebrow>
            <p className="ws__panel-prose">
              Eldest of four. Took care of her mother through the long illness. Met Wim at a dance in '74.
            </p>
          </div>
          <Divider />
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>Linked</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="ws__linked-row">
                <span>Wim de Vries</span><span className="ws__linked-rel">partner</span>
              </div>
              <div className="ws__linked-row">
                <span>Anna</span><span className="ws__linked-rel">daughter</span>
              </div>
              <div className="ws__linked-row">
                <span>Pieter</span><span className="ws__linked-rel">son</span>
              </div>
            </div>
          </div>
          <Divider />
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>Reflection</Eyebrow>
            <p className="ws__panel-prose" style={{ fontStyle: "italic" }}>
              What was never spoken about, but everyone knew?
            </p>
          </div>
        </aside>
      </div>

      <footer className="ws__footer">
        <span className="ws__footer-heart"><IconHeart size={12} filled /></span>
        Personal reflection tool, not therapy. In crisis? Call 113 (NL) or your local helpline.
      </footer>
    </div>
  );
}

window.Workspace = Workspace;
