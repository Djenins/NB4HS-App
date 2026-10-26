// outreachProgram.jsx -- test fixtures for components that sit inside the
// Outreach module: a SNAP `programs` row and option lists shaped like
// lib/outreachPrograms.js returns them, and a wrapper that provides them
// the way pages/Outreach.jsx does.
import { OutreachProgramContext } from "../context/OutreachProgramContext.jsx";

export const snapInfo = {
  key: "snap", module: "outreach", names: { en: "SNAP", ht: "SNAP", fr: "SNAP" }, caseNumberPrefix: "SNAP",
  features: ["contacts", "cases", "tasks"], active: true,
  scopeNotes: { en: "Eligibility decisions are made only by Rhode Island DHS.", ht: "", fr: "" }
};

function opt(setKey, key, en, sortOrder, active) {
  return { id: setKey + ":" + key, setKey, key, labels: { en, ht: en, fr: en }, sortOrder, active: active !== false };
}

export const snapOptions = [
  opt("assistance_type", "application_help", "SNAP application help", 10),
  opt("assistance_type", "recertification", "Recertification / renewal", 20),
  opt("assistance_type", "ebt_card_help", "EBT card help (never ask for the PIN)", 30, false),
  opt("closure_reason", "assistance_completed", "Assistance completed", 10),
  opt("closure_reason", "participant_declined", "Participant declined", 20)
];

export function withProgram(ui, overrides) {
  const value = Object.assign({ program: "snap", programRole: null, info: snapInfo, options: snapOptions }, overrides);
  return <OutreachProgramContext.Provider value={value}>{ui}</OutreachProgramContext.Provider>;
}
