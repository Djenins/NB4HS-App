// useWorkspace.js -- the sidebar's current workspace (plans/unified-access-
// architecture.md §7.2). The page you're on decides it; on a shared or
// record page (calendar, a client profile) the last workspace you chose
// stays. Switching remembers the last page per workspace, so coming back
// lands where you left off. Both are kept in localStorage (per browser).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { navPath } from "./nav.js";
import { navKeyForPath, pickWorkspace, visibleSharedItems, visibleWorkspaces, workspaceOfItem } from "./workspaces.js";

const LAST_KEY = "nb4hs.workspace";
const PAGES_KEY = "nb4hs.workspacePages";

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private window etc. */ }
}

export function useWorkspace(navItems, primary) {
  const location = useLocation();
  const navigate = useNavigate();
  const workspaces = useMemo(() => visibleWorkspaces(navItems), [navItems]);
  const shared = useMemo(() => visibleSharedItems(navItems), [navItems]);
  const [lastChosen, setLastChosen] = useState(() => read(LAST_KEY, null));
  const current = pickWorkspace(workspaces, location.pathname, lastChosen, primary);

  // Remember where you are in the workspace the page belongs to.
  useEffect(() => {
    const ws = workspaceOfItem(navKeyForPath(location.pathname));
    if (!ws) return;
    const pages = read(PAGES_KEY, {});
    pages[ws] = location.pathname + location.search;
    write(PAGES_KEY, pages);
    if (ws !== lastChosen) { setLastChosen(ws); write(LAST_KEY, ws); }
  }, [location.pathname, location.search, lastChosen]);

  const switchTo = useCallback((key) => {
    const ws = workspaces.find((w) => w.key === key);
    if (!ws) return;
    setLastChosen(key);
    write(LAST_KEY, key);
    const remembered = read(PAGES_KEY, {})[key];
    const rememberedKey = remembered && navKeyForPath(remembered.split("?")[0]);
    navigate(remembered && ws.items.indexOf(rememberedKey) !== -1 ? remembered : navPath(ws.items[0]));
  }, [workspaces, navigate]);

  return { workspaces, shared, current: workspaces.find((w) => w.key === current) || null, switchTo };
}
