// CaseNotesPanel.jsx -- notes list + add-a-note box shown when a case
// client's name is expanded. Phase 2 Supabase migration: these notes are
// now the privacy-restricted `case_client_notes` table (RLS: case_manager/
// administrator only -- see plans/wobbly-munching-rose.md), fetched
// per-client on demand instead of living inline on the client record.
import { useEffect, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { fmtDateLong } from "../lib/utils.js";
import { createCaseClientNote, fetchCaseClientNotes } from "../lib/clientsData.js";

export default function CaseNotesPanel({ client }) {
  const { showToast } = useApp();
  const t = useT();
  const [text, setText] = useState("");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCaseClientNotes(client.id).then((rows) => { if (!cancelled) { setNotes(rows); setLoading(false); } });
    return () => { cancelled = true; };
  }, [client.id]);

  async function add() {
    const trimmed = text.trim();
    if (!trimmed) { showToast(t("noteEmpty")); return; }
    const created = await createCaseClientNote(client.id, trimmed);
    setNotes((prev) => [created].concat(prev));
    setText("");
  }

  const sorted = notes.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="case-notes-panel">
      {loading ? (
        <p className="muted">…</p>
      ) : sorted.length ? (
        sorted.map((n) => (
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
