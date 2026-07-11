// CaseNotesPanel.jsx -- notes list + add-a-note box shown when a case
// client's name is expanded. Ported from clients.js's renderCaseNotesPanel().
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { fmtDateLong } from "../lib/utils.js";

export default function CaseNotesPanel({ client, onAddNote }) {
  const { showToast } = useApp();
  const t = useT();
  const [text, setText] = useState("");
  const notes = (client.notes || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  function add() {
    const trimmed = text.trim();
    if (!trimmed) { showToast(t("noteEmpty")); return; }
    onAddNote(trimmed);
    setText("");
  }

  return (
    <div className="case-notes-panel">
      {notes.length ? (
        notes.map((n) => (
          <div className="case-note-item" key={n.id}>
            <div className="note-date">{fmtDateLong(n.date)}</div>
            <div>{n.text}</div>
          </div>
        ))
      ) : (
        <p className="muted">{t("noNotesYet")}</p>
      )}
      <div className="field">
        <textarea rows={2} placeholder={t("notePlaceholder")} aria-label={t("notePlaceholder")} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <button className="btn-secondary btn-sm" onClick={add}>{t("addNoteBtn")}</button>
    </div>
  );
}
