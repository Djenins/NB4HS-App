// AppSidebar.jsx -- the floating application sidebar. Shell.jsx mounts it
// once for every staff page, so navigation looks and behaves the same in
// Workforce, SNAP, Adult Education, Case Management and everywhere else.
//
// It renders a panel only; Shell decides where it floats:
//   * desktop / tablet: a sticky rail inset from the viewport edges, in the
//     page's normal flow so the content column resizes with it
//   * phone: a drawer over a backdrop (variant="drawer")
//
// Which entries appear comes entirely from `items` (nav.js's
// navItemsForRole(), the existing access rules) -- this file only decides
// how they look.
import { useLocation } from "react-router-dom";
import { cn } from "../../lib/cn.js";
import SidebarBrand from "./SidebarBrand.jsx";
import SidebarFooter from "./SidebarFooter.jsx";
import SidebarNavItem from "./SidebarNavItem.jsx";
import SidebarSearch from "./SidebarSearch.jsx";
import SidebarSection from "./SidebarSection.jsx";
import { activeEntryKey } from "./sidebarNav.js";

export default function AppSidebar({ sections, badges, collapsed, drawer, searchPlaceholder, onOpenSearch, onToggleCollapse, onClose, t, className }) {
  const location = useLocation();
  const activeKey = activeEntryKey(sections, location.pathname);

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[24px] border border-sb-border bg-sb-bg text-sb-text shadow-sb backdrop-blur-xl backdrop-saturate-150",
        "transition-[width] duration-[240ms] ease-out motion-reduce:transition-none",
        drawer ? "w-full" : collapsed ? "w-[72px]" : "w-[320px]",
        className
      )}
    >
      <SidebarBrand collapsed={collapsed} drawer={drawer} appTitle={t("appTitle")} onToggle={onToggleCollapse} onClose={onClose} t={t} />
      <SidebarSearch collapsed={collapsed} placeholder={searchPlaceholder} onOpen={onOpenSearch} />

      <nav aria-label={t("sidebarMainNav")} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-1">
        {sections.map((section, i) => (
          <SidebarSection key={section.key} label={section.label} collapsed={collapsed} first={i === 0}>
            {section.entries.map((entry) => (
              <SidebarNavItem
                key={entry.key}
                entry={entry}
                active={entry.key === activeKey}
                collapsed={collapsed}
                badge={badges[entry.key] || 0}
                onNavigate={drawer ? onClose : undefined}
              />
            ))}
          </SidebarSection>
        ))}
      </nav>

      <SidebarFooter collapsed={collapsed} t={t} />
    </div>
  );
}
