// NbIdBadge.jsx -- the clickable blue "NB-#####" badge that appears
// anywhere a unified client is shown (client list rows, the duplicate
// warning modal, the profile header itself), always navigating to that
// person's Client Profile page.
import { useNavigate } from "react-router-dom";
import { Badge } from "./ui/badge.jsx";

export default function NbIdBadge({ nbId, onClick }) {
  const navigate = useNavigate();
  if (!nbId) return null;

  function go(e) {
    e.stopPropagation();
    if (onClick) onClick();
    navigate("/clients/" + nbId);
  }

  return (
    <Badge
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => { if (e.key === "Enter") go(e); }}
      className="cursor-pointer hover:underline"
    >
      {nbId}
    </Badge>
  );
}
