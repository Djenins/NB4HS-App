// LangSelect.jsx -- the language picker on the client-facing screens (kiosk
// top bar). It used to be a native <select>, whose option list is drawn by
// the browser/OS: tiny text, and on some devices it opened away from the
// control. It's now an app-styled menu (Radix, like the rest of the app's
// menus) that drops down right under the button, with fingertip-sized rows
// and each language written in its own name.
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Languages } from "lucide-react";
import { LANGS } from "../lib/constants.js";
import { useApp, useT } from "../context/AppContext.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/dropdown-menu.jsx";

export default function LangSelect() {
  const { lang, setLang } = useApp();
  const t = useT();
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("language") + ": " + current.label}
          className="group flex min-h-[44px] items-center gap-2 rounded-touch border border-border bg-card px-3 text-touch-label font-semibold text-navy transform-none transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[state=open]:border-primary data-[state=open]:bg-primary-tint dark:text-[color:var(--text)] sm:px-4"
        >
          <Languages size={18} strokeWidth={2} aria-hidden="true" className="shrink-0 text-primary" />
          {/* Phone: first word only ("Kreyòl"), so it fits beside Back and the
              logo; the menu always shows the full names. */}
          <span lang={current.code} className="whitespace-nowrap sm:hidden">{current.label.split(" ")[0]}</span>
          <span lang={current.code} className="hidden whitespace-nowrap sm:inline">{current.label}</span>
          <ChevronDown size={16} strokeWidth={2.4} aria-hidden="true" className="shrink-0 text-muted transition-transform duration-150 group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem] rounded-xl p-1.5">
        <DropdownMenuPrimitive.RadioGroup value={lang} onValueChange={setLang}>
          {LANGS.map((l) => (
            <DropdownMenuPrimitive.RadioItem
              key={l.code}
              value={l.code}
              lang={l.code}
              className="flex min-h-[44px] cursor-pointer select-none items-center gap-3 rounded-control px-3 text-touch-body font-semibold text-card-foreground outline-none transition-colors data-[highlighted]:bg-surface-sunken data-[state=checked]:text-primary"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                <DropdownMenuPrimitive.ItemIndicator>
                  <Check size={16} strokeWidth={2.6} aria-hidden="true" />
                </DropdownMenuPrimitive.ItemIndicator>
              </span>
              {l.label}
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuPrimitive.RadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
