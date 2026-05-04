/* Auth landing page — full-bleed forest hero with glass card on right.
   Stacks below 900px (photo top, form bottom). */

function AuthLanding() {
  // Read theme from <html data-theme=…> so the demo shell controls it.
  const getTheme = () => document.documentElement.getAttribute("data-theme") || "dark";
  const [theme, setTheme] = React.useState(getTheme);
  const [showPass, setShowPass] = React.useState(false);
  const [pass, setPass] = React.useState("");
  const [agree, setAgree] = React.useState(false);

  React.useEffect(() => {
    const obs = new MutationObserver(() => setTheme(getTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const heroSrc = theme === "dark" ? "../../assets/hero-dark.webp" : "../../assets/hero-light.webp";

  return (
    <div className="al">
      <style>{`
        .al {
          position: relative;
          min-height: 100vh;
          display: flex;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          font-family: var(--font-body);
        }
        .al__hero {
          position: relative;
          flex: 1;
          background-image: url("${heroSrc}");
          background-size: cover;
          background-position: center;
          min-height: 40vh;
          transition: opacity 0.4s ease;
        }
        .al__hero::after {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, rgba(10,26,15,0.15), rgba(10,26,15,0.6));
          pointer-events: none;
        }
        [data-theme="light"] .al__hero::after {
          background: linear-gradient(180deg, rgba(20,40,28,0.15) 0%, rgba(20,40,28,0.45) 100%);
        }
        .al__hero-text {
          position: absolute; left: 48px; top: 48px; z-index: 2;
          max-width: 380px;
        }
        .al__hero-tagline {
          font-family: var(--font-heading);
          font-weight: 300;
          font-size: 1.4rem;
          line-height: 1.4;
          color: #f4efe6;
          text-shadow: 0 2px 18px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.4);
        }
        .al__form-pane {
          width: 480px;
          flex-shrink: 0;
          padding: 48px;
          display: flex;
          align-items: center;
          background: var(--color-bg-primary);
        }
        .al__card {
          width: 100%;
          padding: 36px 32px;
          border-radius: var(--radius-lg);
          background: rgba(10,26,15,0.78);
          backdrop-filter: blur(20px) saturate(1.2);
          -webkit-backdrop-filter: blur(20px) saturate(1.2);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: var(--shadow-glass);
          animation: al-reveal 0.6s ease-out 0.15s both;
        }
        [data-theme="light"] .al__card {
          background: rgba(255,255,255,0.85);
          border-color: rgba(0,0,0,0.06);
        }
        @keyframes al-reveal {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .al__card { animation: none; }
        }
        .al__h {
          font-family: var(--font-heading);
          font-weight: 200;
          font-size: 2rem;
          line-height: 1.2;
          color: var(--color-text-primary);
          margin-bottom: 8px;
        }
        .al__sub {
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.55;
          margin-bottom: 24px;
        }
        .al__pass-wrap { position: relative; }
        .al__pass-toggle {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          background: transparent; border: none; cursor: pointer;
          color: var(--color-text-muted); padding: 6px;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .al__pass-toggle:hover { color: var(--color-text-primary); }
        .al__warn {
          margin-top: 14px;
          padding: 12px 14px;
          background: var(--color-danger-bg);
          border-left: 3px solid var(--color-danger);
          border-radius: var(--radius-sm);
          font-size: 13px;
          color: var(--color-text-primary);
          line-height: 1.55;
        }
        .al__warn b { color: var(--color-danger); font-weight: 700; }
        .al__theme {
          position: absolute; top: 24px; right: 24px;
        }
        .al__alt {
          margin-top: 18px;
          font-size: 13px;
          text-align: center;
          color: var(--color-text-secondary);
        }
        .al__alt a { color: var(--color-accent); text-decoration: none; }
        .al__alt a:hover { color: var(--color-accent-hover); }
        @media (max-width: 900px) {
          .al { flex-direction: column; }
          .al__form-pane { width: 100%; padding: 24px; }
        }
      `}</style>
      <div className="al__hero">
        <div className="al__hero-text">
          <Logo size={32} />
          <div className="al__hero-tagline" style={{ marginTop: 18 }}>
            A quiet place to map the patterns you carry.
          </div>
        </div>
      </div>
      <div className="al__form-pane">
        {/* Theme toggle lives in the demo shell nav so it works across all screens. */}
        <div className="al__card">
          <h1 className="al__h">Create account</h1>
          <p className="al__sub">
            Your data is encrypted before it leaves your device. The server sees no content.
          </p>
          <FieldGroup>
            <Field label="Email">
              <Input type="email" placeholder="you@example.com" defaultValue="" />
            </Field>
            <Field
              label="Passphrase"
              hint="Use a sentence you can remember. 12+ characters."
            >
              <div className="al__pass-wrap">
                <Input
                  type={showPass ? "text" : "password"}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="A sentence only you would write"
                />
                <button
                  type="button"
                  className="al__pass-toggle"
                  aria-label={showPass ? "Hide passphrase" : "Show passphrase"}
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </Field>
          </FieldGroup>
          <div className="al__warn">
            <b>This cannot be recovered.</b> If you lose your passphrase, your data is unrecoverable. This is by design.
          </div>
          <div style={{ marginTop: 18 }}>
            <Checkbox checked={agree} onChange={setAgree}>
              I understand and want to continue
            </Checkbox>
          </div>
          <div style={{ marginTop: 22 }}>
            <Button variant="primary" size="lg" style={{ width: "100%", justifyContent: "center" }}>
              Create account
            </Button>
          </div>
          <div className="al__alt">
            Already have an account? <a href="#login">Log in</a>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AuthLanding = AuthLanding;
