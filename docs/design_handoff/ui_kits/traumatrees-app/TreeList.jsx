/* My Trees — list of the user's trees. Authenticated. */

function TreeList() {
  const trees = [
    { id: 1, name: "My family", people: 12, edited: "12s ago", patterns: 3 },
    { id: 2, name: "Maternal line", people: 8, edited: "yesterday", patterns: 1 },
    { id: 3, name: "Demo tree", people: 22, edited: "3 weeks ago", patterns: 7, demo: true },
  ];

  return (
    <div className="tl">
      <style>{`
        .tl { min-height: 100vh; background: var(--color-bg-primary); color: var(--color-text-primary); font-family: var(--font-body); display: flex; flex-direction: column; }
        .tl__nav {
          display: flex; align-items: center; gap: 16px;
          padding: 14px 32px;
          border-bottom: 1px solid var(--color-border-secondary);
          background: var(--color-bg-primary);
        }
        .tl__nav-spacer { flex: 1; }
        .tl__nav-link {
          font-size: 13px; color: var(--color-text-secondary);
          text-decoration: none; cursor: pointer;
        }
        .tl__nav-link:hover { color: var(--color-text-primary); }
        .tl__main { max-width: 760px; margin: 0 auto; width: 100%; padding: 48px 32px; flex: 1; }
        .tl__welcome {
          padding: 28px;
          margin-bottom: 32px;
          border-radius: var(--radius-lg);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-primary);
          display: flex; gap: 24px; align-items: center;
          background-image: linear-gradient(90deg, var(--color-bg-secondary), var(--color-bg-secondary) 60%, transparent), url("../../assets/welcome-dark.webp");
          background-size: cover;
          background-position: right center;
        }
        [data-theme="light"] .tl__welcome {
          background-image: linear-gradient(90deg, var(--color-bg-secondary), var(--color-bg-secondary) 60%, transparent), url("../../assets/welcome-light.webp");
        }
        .tl__welcome-text { flex: 1; }
        .tl__h {
          font-family: var(--font-heading);
          font-weight: 200; font-size: 2rem; line-height: 1.2;
          margin-bottom: 8px;
        }
        .tl__sub { font-size: 14px; color: var(--color-text-secondary); line-height: 1.55; }
        .tl__list-h { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
        .tl__h2 { font-family: var(--font-heading); font-weight: 300; font-size: 1.35rem; }
        .tl__list { display: flex; flex-direction: column; gap: 8px; }
        .tl__item {
          display: flex; align-items: center; gap: 16px;
          padding: 16px 18px;
          border-radius: var(--radius-md);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-secondary);
          cursor: pointer;
          transition: var(--transition-colors);
        }
        .tl__item:hover { background: var(--color-bg-hover); border-color: var(--color-border-primary); }
        .tl__item-name { font-family: var(--font-heading); font-weight: 300; font-size: 1.15rem; color: var(--color-text-primary); }
        .tl__item:hover .tl__item-name { color: var(--color-accent); }
        .tl__item-meta { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
        .tl__item-stats { display: flex; gap: 10px; align-items: center; }
        .tl__chev { color: var(--color-text-muted); }
        .tl__demo-tag {
          font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
          padding: 2px 7px; background: var(--color-accent-subtle); color: var(--color-accent);
          border-radius: 4px; margin-left: 8px;
        }
        .tl__empty {
          margin-top: 18px; padding: 22px; border-radius: var(--radius-md);
          background: rgba(255,255,255,0.02); border: 1px dashed var(--color-border-secondary);
          font-size: 13px; color: var(--color-text-muted); text-align: center;
        }
      `}</style>

      <nav className="tl__nav">
        <Logo size={26} />
        <div className="tl__nav-spacer" />
        <a className="tl__nav-link">Privacy</a>
        <a className="tl__nav-link">Settings</a>
        <IconButton icon={<IconLock size={15} />} label="Lock" />
        <IconButton icon={<IconMoon size={15} />} label="Theme" />
      </nav>

      <main className="tl__main">
        <div className="tl__welcome">
          <div className="tl__welcome-text">
            <h1 className="tl__h">My Trees</h1>
            <p className="tl__sub">
              You set the pace. Pause or stop whenever you want.
            </p>
          </div>
          <Button variant="primary" icon={<IconPlus size={14} />}>New tree</Button>
        </div>

        <div className="tl__list-h">
          <h2 className="tl__h2">Your trees</h2>
          <span className="tt-eyebrow">{trees.length} total</span>
        </div>

        <div className="tl__list">
          {trees.map((t) => (
            <div key={t.id} className="tl__item">
              <Logomark size={28} />
              <div style={{ flex: 1 }}>
                <div className="tl__item-name">
                  {t.name}
                  {t.demo && <span className="tl__demo-tag">Demo</span>}
                </div>
                <div className="tl__item-meta">
                  {t.people} people · {t.patterns} patterns · edited {t.edited}
                </div>
              </div>
              <div className="tl__item-stats">
                <Badge tone="neutral" dot={false}>{t.people}</Badge>
              </div>
              <span className="tl__chev"><IconChevronRight size={16} /></span>
            </div>
          ))}
        </div>

        <div className="tl__empty">
          Not sure where to start? Create a demo tree with fictional data to explore all features first.
        </div>
      </main>
    </div>
  );
}

window.TreeList = TreeList;
