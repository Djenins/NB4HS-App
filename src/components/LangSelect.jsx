// LangSelect.jsx -- the language <select> that appeared in the header on
// every screen (login, staff login, and the main shell) in the original.
import { LANGS } from "../lib/constants.js";
import { useApp, useT } from "../context/AppContext.jsx";

export default function LangSelect() {
  const { lang, setLang } = useApp();
  const t = useT();
  return (
    <div className="lang-select">
      <select aria-label={t("language")} value={lang} onChange={(e) => setLang(e.target.value)}>
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </div>
  );
}
