// AuthShell.jsx -- shared split-screen frame for the two public,
// unauthenticated pages (Login.jsx, StaffLogin.jsx): a brand-color panel on
// the left (logo + optional tagline + footer credit), plain content on the
// right (theme/lang controls, then whatever the page passes as children).
// Pulled out as its own component rather than duplicated markup because
// both pages now share this exact shell -- one place to fix if the layout
// needs to change again.
import { ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import ThemeToggle from "./ThemeToggle.jsx";
import LangSelect from "./LangSelect.jsx";

export default function AuthShell({ tagline, foot, children }) {
  return (
    <div className="auth-split">
      <div className="auth-split-panel no-print">
        <div className="auth-split-brand">
          <img src={LOGO_DATA_URI} alt={ORG.name} />
          <span>{ORG.shortName}</span>
        </div>
        {tagline && <p className="auth-split-tagline">{tagline}</p>}
        {foot && <p className="auth-split-foot">{foot}</p>}
      </div>
      <div className="auth-split-content">
        <div className="auth-split-controls no-print">
          <ThemeToggle />
          <LangSelect />
        </div>
        <div className="auth-split-form-wrap">{children}</div>
      </div>
    </div>
  );
}
