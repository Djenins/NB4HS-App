// CaseNotesPanel.jsx -- notes list + add-a-note box shown when a case
// client's name is expanded. Phase 2 Supabase migration: these notes are
// now the privacy-restricted `case_client_notes` table (RLS: case_manager/
// administrator only -- see plans/wobbly-munching-rose.md), fetched
// per-client on demand instead of living inline on the client record.
import { useEffect, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { fmtDateLong } from "../lib/utils.js";
import { createCaseClientNote, fetchCaseClientNotes } from "../lib/clientsData.js";
import { fetchGrants } from "../lib/grants.js";
import { fetchGrantTagsForRecords, setRecordGrantTag } from "../lib/serviceGrantTags.js";

const NOTE_TABLE = "case_client_notes";

export default function CaseNotesPanel({ client }) {
  const { showToast } = useApp();
  const t = useT();
  const [text, setText] = useState("");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState([]);
  const [grantTags, setGrantTags] = useState({});
  const [grantId, setGrantId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCaseClientNotes(client.id).then((rows) => {
      if (cancelled) return;
      setNotes(rows);
      setLoading(false);
      fetchGrantTagsForRecords(NOTE_TABLE, rows.map((n) => n.id)).then((map) => { if (!cancelled) setGrantTags(map); });
    });
    fetchGrants().then((rows) => { if (!cancelled) setGrants(rows.filter((g) => g.active)); });
    return () => { cancelled = true; };
  }, [client.id]);

  async function add() {
    const trimmed = text.trim();
    if (!trimmed) { showToast(t("noteEmpty")); return; }
    const created = await createCaseClientNote(client.id, trimmed);
    if (grantId) {
      await setRecordGrantTag(NOTE_TABLE, created.id, grantId);
      setGrantTags((prev) => Object.assign({}, prev, { [created.id]: grantId }));
    }
    setNotes((prev) => [created].concat(prev));
    setText("");
    setGrantId("");
  }

  const sorted = notes.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const grantName = (id) => { const g = grants.find((x) => x.id === id); return g ? g.name : ""; };

  return (
    <div className="case-notes-panel">
      {loading ? (
        <p className="muted">…</p>
      ) : sorted.length ? (
        sorted.map((n) => (
          <div className="case-note-item" key={n.id}>
            <div className="note-date">{fmtDateLong(n.date)}</div>
            <div>{n.text}</div>
            {grantTags[n.id] ? <div className="badge badge-in" style={{ marginTop: 4 }}>{grantName(grantTags[n.id])}</div> : null}
          </div>
        ))
      ) : (
        <p className="muted">{t("noNotesYet")}</p>
      )}
      <div className="field">
        <textarea rows={2} placeholder={t("notePlaceholder")} aria-label={t("notePlaceholder")} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {grants.length ? (
        <div className="field">
          <label>Tag to Grant (optional)</label>
          <select aria-label="Tag to grant" value={grantId} onChange={(e) => setGrantId(e.target.value)}>
            <option value="">No grant</option>
            {grants.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      ) : null}
      <button className="btn-secondary btn-sm" onClick={add}>{t("addNoteBtn")}</button>
    </div>
  );
}
