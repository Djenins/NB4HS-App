// Communications.jsx -- the Communications module (c1_communications): one
// sidebar entry opening /communications/:section, with a ModuleNav strip
// over its four sections. Each section shows only for the permission behind
// it, and the database enforces the same permissions on its own:
//
//   log            communications.view            every client's communications log + follow-ups
//   messages       communications.messages.send   texts and emails to clients, and their status
//                  (or .view)
//   newsletters    communications.newsletters.send one email to every consenting client in an audience
//   templates      communications.templates.manage reusable client messages
//   announcements  communications.announcements.view (or .post)  notices to all staff
//
// A receptionist, who only reads announcements, lands straight on them.
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { FileText, Megaphone, MessagesSquare, Newspaper, Send } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import ModuleNav from "../components/ModuleNav.jsx";
import Announcements from "../components/communications/Announcements.jsx";
import ClientMessages from "../components/communications/ClientMessages.jsx";
import CommunicationLog from "../components/communications/CommunicationLog.jsx";
import MessageTemplates from "../components/communications/MessageTemplates.jsx";
import Newsletters from "../components/communications/Newsletters.jsx";

const SECTIONS = {
  log: { label: "commsSectionLog", icon: MessagesSquare, Component: CommunicationLog, perms: ["communications.view"] },
  messages: { label: "commsSectionMessages", icon: Send, Component: ClientMessages, perms: ["communications.messages.send", "communications.view"] },
  templates: { label: "commsSectionTemplates", icon: FileText, Component: MessageTemplates, perms: ["communications.templates.manage"] },
  newsletters: { label: "commsSectionNewsletters", icon: Newspaper, Component: Newsletters, perms: ["communications.newsletters.send"] },
  announcements: { label: "commsSectionAnnouncements", icon: Megaphone, Component: Announcements, perms: ["communications.announcements.view", "communications.announcements.post"] }
};
const ORDER = ["log", "messages", "newsletters", "templates", "announcements"];

// Which sections these permissions open, in order.
export function communicationsSectionsFor(can) {
  return ORDER.filter((key) => SECTIONS[key].perms.some((p) => can(p)));
}

export default function Communications() {
  const { can } = useApp();
  const t = useT();
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const visible = communicationsSectionsFor(can);
  if (!visible.length) return <Navigate to="/" replace />;
  if (params.section && visible.indexOf(params.section) === -1) return <Navigate to={"/communications/" + visible[0]} replace />;
  const section = params.section || visible[0];
  const Active = SECTIONS[section].Component;
  const intent = (location.state && location.state.intent) || null;

  return (
    <>
      {visible.length > 1 ? (
        <ModuleNav
          label={t("navCommunications")}
          items={visible.map((key) => ({ key, label: t(SECTIONS[key].label), icon: SECTIONS[key].icon }))}
          value={section}
          onChange={(key) => navigate("/communications/" + key)}
        />
      ) : null}
      <Active key={section + location.key} intent={intent} />
    </>
  );
}
