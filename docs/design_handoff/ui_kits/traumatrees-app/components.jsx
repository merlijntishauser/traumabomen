/* Shared atoms for the Traumatrees UI kit.
   Loaded with <script type="text/babel" src="components.jsx"></script>.
   At end of file, components are exported to window so other JSX files
   can use them without re-importing. */

// ---- Lucide-grammar SVG icons (24x24, 2px stroke, currentColor) -----------

const Icon = ({ d, size = 16, strokeWidth = 2, fill = "none", style, ...rest }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill={fill} stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
    {...rest}
  >
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const IconLock = (props) => (
  <Icon {...props} d={<>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </>} />
);
const IconUnlock = (props) => (
  <Icon {...props} d={<>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 019.9-1" />
  </>} />
);
const IconHeart = ({ filled, ...rest }) => (
  <Icon
    {...rest}
    fill={filled ? "currentColor" : "none"}
    strokeWidth={filled ? 0 : 2}
    d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
  />
);
const IconSun = (props) => (
  <Icon {...props} d={<>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </>} />
);
const IconMoon = (props) => <Icon {...props} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />;
const IconEye = (props) => (
  <Icon {...props} d={<>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </>} />
);
const IconEyeOff = (props) => (
  <Icon {...props} d={<>
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <path d="M1 1l22 22" />
  </>} />
);
const IconMessage = (props) => (
  <Icon {...props} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
);
const IconPlus = (props) => <Icon {...props} d="M12 5v14M5 12h14" />;
const IconClose = (props) => <Icon {...props} d="M18 6L6 18M6 6l12 12" />;
const IconMore = (props) => (
  <Icon {...props} fill="currentColor" strokeWidth={0} d={<>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </>} />
);
const IconChevronRight = (props) => <Icon {...props} d="M9 18l6-6-6-6" />;
const IconLeaf = (props) => (
  <Icon {...props} d={<>
    <path d="M11 20A7 7 0 014 13c0-5 4-9 12-11-1 6-2 9-4 11" />
    <path d="M11 20l-2-7" />
  </>} />
);
const IconTreeView = (props) => (
  <Icon {...props} d={<>
    <circle cx="12" cy="5" r="2" />
    <circle cx="6" cy="14" r="2" />
    <circle cx="18" cy="14" r="2" />
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="15" cy="20" r="1.5" />
    <path d="M12 7v3M6 12V9.5l6-2 6 2V12M9 18.5l-3-2.5M15 18.5l3-2.5" />
  </>} />
);
const IconTimeline = (props) => (
  <Icon {...props} d="M3 12h18M7 6v12M13 6v12M19 6v12" />
);
const IconPatterns = (props) => (
  <Icon {...props} d={<>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="7" strokeDasharray="2 3" />
    <circle cx="12" cy="12" r="10" strokeDasharray="1 4" />
  </>} />
);
const IconPenLine = (props) => (
  <Icon {...props} d={<>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4z" />
  </>} />
);
const IconImage = (props) => (
  <Icon {...props} d={<>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15l-5-5L5 21" />
  </>} />
);
const IconFile = (props) => (
  <Icon {...props} d={<>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </>} />
);
const IconConnections = (props) => (
  <Icon {...props} d={<>
    <circle cx="12" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="19" r="2" />
    <path d="M12 7v4M12 11l-6 6M12 11l6 6" />
  </>} />
);
const IconSearch = (props) => (
  <Icon {...props} d={<>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </>} />
);
const IconCheck = (props) => <Icon {...props} d="M20 6L9 17l-5-5" strokeWidth={2.5} />;

// ---- Atoms ----------------------------------------------------------------

const Button = ({ variant = "primary", size = "md", icon, children, className = "", ...rest }) => {
  const base = "tt-btn";
  const cls = `${base} ${base}--${variant} ${base}--${size} ${className}`.trim();
  return (
    <button className={cls} {...rest}>
      {icon}
      {children}
    </button>
  );
};

const IconButton = ({ icon, label, className = "", ...rest }) => (
  <button className={`tt-icon-btn ${className}`.trim()} aria-label={label} {...rest}>
    {icon}
  </button>
);

const Field = ({ label, hint, error, children }) => (
  <div className="tt-field">
    {label && <label className="tt-field__label">{label}</label>}
    {children}
    {hint && !error && <div className="tt-field__hint">{hint}</div>}
    {error && <div className="tt-field__error">{error}</div>}
  </div>
);

const Input = ({ className = "", ...rest }) => (
  <input className={`tt-input ${className}`.trim()} {...rest} />
);

const Textarea = ({ className = "", ...rest }) => (
  <textarea className={`tt-input tt-textarea ${className}`.trim()} {...rest} />
);

const FieldGroup = ({ children, style }) => (
  <div className="tt-field-group" style={style}>{children}</div>
);

const Checkbox = ({ checked, onChange, children }) => (
  <label className="tt-checkbox" onClick={() => onChange?.(!checked)}>
    <span className={`tt-checkbox__box ${checked ? "is-checked" : ""}`}>
      {checked && <IconCheck size={9} strokeWidth={3.5} />}
    </span>
    <span>{children}</span>
  </label>
);

const Badge = ({ tone = "neutral", children, dot = true }) => (
  <span className={`tt-badge tt-badge--${tone}`}>
    {dot && <span className="tt-badge__dot" />}
    {children}
  </span>
);

const Eyebrow = ({ children, style }) => <div className="tt-eyebrow" style={style}>{children}</div>;

const Card = ({ variant = "solid", children, style, className = "", onClick }) => (
  <div className={`tt-card tt-card--${variant} ${className}`.trim()} style={style} onClick={onClick}>
    {children}
  </div>
);

const Divider = ({ style }) => <div className="tt-divider" style={style} />;

const Logomark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 56 L32 38" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M32 38 Q32 30 22 26" stroke="var(--color-accent)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M32 38 Q32 30 42 26" stroke="var(--color-accent)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M22 26 Q22 19 14 16" stroke="var(--color-accent)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <path d="M22 26 Q22 19 28 14" stroke="var(--color-accent)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <path d="M42 26 Q42 19 38 14" stroke="var(--color-accent)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <path d="M42 26 Q42 19 50 16" stroke="var(--color-accent)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <circle cx="32" cy="38" r="3" fill="var(--color-accent)" />
    <circle cx="22" cy="26" r="2.5" fill="var(--color-accent)" />
    <circle cx="42" cy="26" r="2.5" fill="var(--color-accent)" />
    <circle cx="14" cy="16" r="2" fill="var(--color-text-primary)" />
    <circle cx="28" cy="14" r="2" fill="var(--color-trauma-loss)" />
    <circle cx="38" cy="14" r="2" fill="var(--color-classification-suspected)" />
    <circle cx="50" cy="16" r="2" fill="var(--color-text-muted)" />
  </svg>
);

const Logo = ({ size = 28, withWord = true }) => (
  <span className="tt-logo">
    <Logomark size={size} />
    {withWord && <span className="tt-logo__word">traumabomen</span>}
  </span>
);

// ---- Shared global stylesheet (injected once) -----------------------------

const ttCss = `
.tt-btn {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 13px;
  padding: 9px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  line-height: 1.2;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition-colors);
  white-space: nowrap;
}
.tt-btn--lg { padding: 12px 22px; font-size: 14px; }
.tt-btn--sm { padding: 6px 12px; font-size: 12px; }

.tt-btn--primary { background: var(--color-accent); color: var(--color-text-inverse); border-color: var(--color-accent); }
.tt-btn--primary:hover { background: var(--color-accent-hover); border-color: var(--color-accent-hover); }
.tt-btn--secondary { background: var(--color-bg-tertiary); color: var(--color-text-primary); border-color: var(--color-border-primary); }
.tt-btn--secondary:hover { background: var(--color-bg-hover); }
.tt-btn--ghost { background: transparent; color: var(--color-text-secondary); }
.tt-btn--ghost:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.tt-btn--danger { background: var(--color-danger-solid, #b91c1c); color: #fff; border-color: var(--color-danger-solid, #b91c1c); }
.tt-btn--danger:hover { background: var(--color-danger-solid-hover, #991b1b); }
.tt-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--color-accent-focus-ring); }

.tt-icon-btn {
  width: 34px; height: 34px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; color: var(--color-text-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-sm);
  cursor: pointer; transition: var(--transition-colors);
}
.tt-icon-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.tt-icon-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--color-accent-focus-ring); }

.tt-field { display: flex; flex-direction: column; gap: 6px; }
.tt-field__label { font-family: var(--font-body); font-size: 13px; font-weight: 700; color: var(--color-text-secondary); }
.tt-field__hint { font-size: 12px; color: var(--color-text-muted); }
.tt-field__error { font-size: 12px; color: var(--color-danger); }

.tt-input {
  width: 100%; font-family: var(--font-body); font-size: 15px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.03);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-sm);
  outline: none; transition: var(--transition-colors);
}
.tt-input:focus { border-color: var(--color-border-focus); box-shadow: 0 0 0 2px var(--color-accent-focus-ring); }
.tt-input::placeholder { color: var(--color-text-muted); }
[data-theme="light"] .tt-input { background: rgba(0,0,0,0.02); }
.tt-textarea { min-height: 80px; resize: vertical; line-height: 1.55; }

.tt-field-group {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex; flex-direction: column; gap: 14px;
}
[data-theme="light"] .tt-field-group { background: rgba(0,0,0,0.02); }

.tt-checkbox { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-primary); cursor: pointer; user-select: none; }
.tt-checkbox__box {
  width: 16px; height: 16px;
  border: 1.5px solid var(--color-border-primary);
  border-radius: 3px;
  background: rgba(255,255,255,0.03);
  flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-text-inverse);
  transition: var(--transition-colors);
}
.tt-checkbox__box.is-checked { background: var(--color-accent); border-color: var(--color-accent); }

.tt-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--font-body); font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: 4px;
  letter-spacing: 0.02em;
}
.tt-badge__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

.tt-badge--neutral { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.tt-badge--accent { background: var(--color-accent-subtle); color: var(--color-accent); }
.tt-badge--loss { background: rgba(129,140,248,0.12); color: var(--color-trauma-loss); }
.tt-badge--abuse { background: rgba(248,113,113,0.12); color: var(--color-trauma-abuse); }
.tt-badge--addiction { background: rgba(251,191,36,0.12); color: var(--color-trauma-addiction); }
.tt-badge--war { background: rgba(168,162,158,0.12); color: var(--color-trauma-war); }
.tt-badge--displacement { background: rgba(232,121,249,0.12); color: var(--color-trauma-displacement); }
.tt-badge--illness { background: rgba(34,211,238,0.12); color: var(--color-trauma-illness); }
.tt-badge--poverty { background: rgba(167,139,250,0.12); color: var(--color-trauma-poverty); }
.tt-badge--cycle { background: rgba(52,211,153,0.12); color: var(--color-tp-cycle-breaking); border: 1px solid rgba(52,211,153,0.3); }
.tt-badge--protective { background: rgba(96,165,250,0.12); color: var(--color-tp-protective-relationship); border: 1px solid rgba(96,165,250,0.3); }
.tt-badge--recovery { background: rgba(167,139,250,0.12); color: var(--color-tp-recovery); border: 1px solid rgba(167,139,250,0.3); }

.tt-eyebrow {
  font-family: var(--font-body);
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--color-text-muted);
}

.tt-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.tt-card--solid { background: var(--color-bg-secondary); }
.tt-card--glass {
  background: rgba(10, 26, 15, 0.78);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: var(--shadow-glass);
}
[data-theme="light"] .tt-card--glass {
  background: rgba(247, 245, 242, 0.82);
  border-color: rgba(0,0,0,0.06);
}

.tt-divider { height: 1px; background: var(--color-border-secondary); }

.tt-logo { display: inline-flex; align-items: center; gap: 10px; }
.tt-logo__word {
  font-family: var(--font-heading);
  font-weight: 200;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}

@media (prefers-reduced-motion: reduce) {
  .tt-btn, .tt-icon-btn, .tt-input, .tt-checkbox__box { transition: none; }
}
`;

if (typeof document !== "undefined" && !document.getElementById("__tt_kit_css")) {
  const s = document.createElement("style");
  s.id = "__tt_kit_css";
  s.textContent = ttCss;
  document.head.appendChild(s);
}

Object.assign(window, {
  Icon, IconLock, IconUnlock, IconHeart, IconSun, IconMoon, IconEye, IconEyeOff,
  IconMessage, IconPlus, IconClose, IconMore, IconChevronRight, IconLeaf,
  IconTreeView, IconTimeline, IconPatterns, IconPenLine, IconImage, IconFile,
  IconConnections, IconSearch, IconCheck,
  Button, IconButton, Field, Input, Textarea, FieldGroup, Checkbox,
  Badge, Eyebrow, Card, Divider, Logomark, Logo,
});
