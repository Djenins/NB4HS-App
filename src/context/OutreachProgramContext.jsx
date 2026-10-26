// OutreachProgramContext.jsx -- which outreach program the Outreach module
// is showing, provided by pages/Outreach.jsx to every section below it:
// { program: "snap", programRole, info (the programs row), options (its
// option lists) }. Sections read the program from here instead of naming
// SNAP, so the same screens serve any outreach program.
import { createContext, useContext } from "react";

export const OutreachProgramContext = createContext(null);

export function useOutreachProgram() {
  const value = useContext(OutreachProgramContext);
  if (!value) throw new Error("useOutreachProgram() must be used inside the Outreach module");
  return value;
}
