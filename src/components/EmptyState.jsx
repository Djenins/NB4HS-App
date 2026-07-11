// EmptyState.jsx -- icon + message block for empty lists/tables.
// Ported from icons.js's emptyState() string builder.
import Icon from "./Icon.jsx";

export default function EmptyState({ icon, message }) {
  return (
    <div className="empty-state">
      <Icon name={icon} className="icon-lg" />
      <p>{message}</p>
    </div>
  );
}
