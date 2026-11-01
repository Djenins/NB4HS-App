// ThemeToggle.jsx -- replaces storage.js's old themeToggleButtonHtml() string
// builder (removed; see storage.js's comment). Restyled from a single icon
// button into a segmented "Light | Dark" pill (reference: Babar admin panel
// sidebar footer) -- same toggleTheme() action underneath, just a clearer
// two-option control. `compact` renders the old icon-only single button
// instead, for tight spaces (the collapsed icon-rail sidebar).
import { useApp, useT } from "../context/AppContext.jsx";
import Icon from "./Icon.jsx";
import { IconButton } from "./ui/icon-button.jsx";

export default function ThemeToggle({ compact }) {
  const { config, toggleTheme } = useApp();
  const t = useT();
  const isDark = config.theme === "dark";

  if (compact) {
    return (
      <IconButton
        id="btn-theme-toggle"
        label={isDark ? t("switchToLightMode") : t("switchToDarkMode")}
        onClick={toggleTheme}
      >
        <Icon name={isDark ? "sun" : "moon"} />
      </IconButton>
    );
  }

  return (
    <div className="theme-pill" role="group" aria-label={t("switchToLightMode") + " / " + t("switchToDarkMode")}>
      <button
        type="button"
        className={"theme-pill-option" + (isDark ? "" : " active")}
        aria-pressed={!isDark}
        onClick={() => { if (isDark) toggleTheme(); }}
        title={t("switchToLightMode")}
      >
        <Icon name="sun" />
        <span>{t("themeLightOption")}</span>
      </button>
      <button
        type="button"
        className={"theme-pill-option" + (isDark ? " active" : "")}
        aria-pressed={isDark}
        onClick={() => { if (!isDark) toggleTheme(); }}
        title={t("switchToDarkMode")}
      >
        <Icon name="moon" />
        <span>{t("themeDarkOption")}</span>
      </button>
    </div>
  );
}
