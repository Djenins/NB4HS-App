// navIcons.js -- maps NB4HS's real nav item keys to Lucide icon components,
// for the Tailwind/shadcn sidebar redesign pass (Shell.jsx) only. The rest
// of the app keeps using components/Icon.jsx + lib/icons.js (its inline
// SVG set) -- this file doesn't replace that, it's scoped to the sidebar.
import {
  BarChart3, Briefcase, Building2, CalendarDays, CalendarClock, CheckCircle2, ClipboardCheck, FileText,
  FolderKanban, GraduationCap, KanbanSquare, LayoutDashboard, ListChecks, LogIn, LogOut, QrCode, Search,
  Settings, ShoppingBasket, UserSearch, Users
} from "lucide-react";

export var NAV_ICONS = {
  dashboard: LayoutDashboard,
  mycaseload: CalendarClock,
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
  // Employer & Job Opportunity Management module -- workforceDevelopmentGroup
  // is the collapsible submenu's own toggle row (Shell.jsx), not a real nav
  // key/route.
  workforceDevelopmentGroup: Briefcase,
  workforcedashboard: LayoutDashboard,
  employers: Building2,
  jobopenings: FileText,
  candidatematching: UserSearch,
  referrals: KanbanSquare,
  placements: CheckCircle2,
  workforcereports: BarChart3,
  users: Users,
  settings: Settings
};
