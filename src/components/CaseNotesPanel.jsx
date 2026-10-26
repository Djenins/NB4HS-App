// CaseNotesPanel.jsx -- a case client's notes list + add-a-note box, shown
// in CaseClientCard's drawer. Phase 2 Supabase migration: these notes are
// the privacy-restricted `case_client_notes` table (RLS: case_manager/
// administrator only -- see plans/wobbly-munching-rose.md), fetched
// per-client on demand instead of living inline on the client record.
// Presentation is on the NB4HS Operate design system; the data calls and
// the optional grant tag are unchanged.
import { useEffect, useId, useState } from "react";
import { Award, NotebookPen } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { fmtDateLong } from "../lib/utils.js";
import { createCaseClientNote, fetchCaseClientNotes } from "../lib/clientsData.js";
import { fetchGrants } from "../lib/grants.js";
import { fetchGrantTagsForRecords, setRecordGrantTag } from "../lib/serviceGrantTags.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { EmptyState } from "./ui/empty-state.jsx";
import { Field, Select, Textarea } from "./ui/field.jsx";
import { Skeleton } from "./ui/skeleton.jsx";

const NOTE_TABLE = "case_client_notes";

export default function CaseNotesPanel({ client }) {
  const { showToast } = useApp();
  const t = useT();
  const idBase = useId();
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
    <section aria-labelledby={idBase + "-title"}>
      <h3 id={idBase + "-title"} className="m-0 text-section font-semibold text-card-foreground">{t("caseNotesHeading")}</h3>

      <div className="mt-3" aria-busy={loading || undefined}>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : sorted.length ? (
          <ul className="m-0 list-none divide-y divide-line-subtle p-0">
            {sorted.map((n) => (
              <li key={n.id} className="py-3 first:pt-0">
                <div className="text-meta tabular-nums text-muted">{fmtDateLong(n.date)}</div>
                <div className="mt-0.5 whitespace-pre-wrap break-words text-body text-card-foreground">{n.text}</div>
                {grantTags[n.id] ? (
                  <div className="mt-1.5"><Badge variant="violet"><Award className="h-3 w-3" aria-hidden="true" />{grantName(grantTags[n.id])}</Badge></div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={NotebookPen} title={t("noNotesYet")} description={t("caseNotesEmptyHint")} className="py-6" />
        )}
      </div>

      <div className="mt-4 space-y-3 border-t border-line-subtle pt-4">
        <Field label={t("caseNoteNewLabel")} htmlFor={idBase + "-text"}>
          <Textarea id={idBase + "-text"} rows={3} placeholder={t("notePlaceholder")} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        {grants.length ? (
          <Field label={t("caseNoteGrantLabel")} htmlFor={idBase + "-grant"}>
            <Select id={idBase + "-grant"} value={grantId} onChange={(e) => setGrantId(e.target.value)}>
              <option value="">{t("noGrantOption")}</option>
              {grants.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
        ) : null}
        <Button variant="secondary" onClick={add}>{t("addNoteBtn")}</Button>
      </div>
    </section>
  );
}
