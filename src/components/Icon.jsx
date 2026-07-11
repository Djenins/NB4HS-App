// Icon.jsx -- renders one of ICON_PATHS as a real <svg>. Uses
// dangerouslySetInnerHTML for just the inner <path>/<rect>/<circle> group;
// that's safe here because the content is our own static, hardcoded string
// data (icons.js), never anything derived from user input.
import { ICON_PATHS } from "../lib/icons.js";

export default function Icon({ name, className }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={"icon" + (className ? " " + className : "")}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}
