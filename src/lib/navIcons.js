// navIcons.js -- maps NB4HS's real nav item keys to Lucide icon components,
// for the Tailwind/shadcn sidebar redesign pass (Shell.jsx) only. The rest
// of the app keeps using components/Icon.jsx + lib/icons.js (its inline
// SVG set) -- this file doesn't replace that, it's scoped to the sidebar.
import {
  BarChart3, Briefcase, CalendarDays, ClipboardCheck, FolderKanban, GraduationCap,
  LayoutDashboard, ListChecks, LogIn, LogOut, QrCode, Search, Settings, ShoppingBasket, Users
} from "lucide-react";

export var NAV_ICONS = {
  dashboard: LayoutDashboard,
  checkin: LogIn,
  checkout: LogOut,
  search: Search,
  reports: BarChart3,
  fooddistribution: ShoppingBasket,
  calendar: CalendarDays,
  qrcode: QrCode,
  manage: ListChecks,
  students: GraduationCap,
  assessments: ClipboardCheck,
  casemanagement: FolderKanban,
  jobdeveloper: Briefcase,
  users: Users,
  settings: Settings
};
