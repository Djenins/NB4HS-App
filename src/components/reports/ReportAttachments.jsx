// ReportAttachments.jsx -- a report's files (p6c): the author adds and
// removes them while the report is editable; anyone who can read the report
// downloads them through a one-minute signed link. Files a reviewer already
// saw in an earlier submission can't be removed during a revision. The
// database enforces all of it; this only explains it.
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Paperclip, Trash2 } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  ATTACHMENTS_MAX, ATTACHMENT_TYPES, attachmentProblem, attachmentRemovable, attachmentUrl, fetchAttachments, fmtBytes,
  removeAttachment, uploadAttachment
} from "../../lib/staffReports.js";
import { Button } from "../ui/button.jsx";

const ACCEPT = Object.keys(ATTACHMENT_TYPES).join(",");

export default function ReportAttachments({ report, editable }) {
  const { showToast, requestConfirm } = useApp();
  const t = useT();
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const load = useCallback(() => fetchAttachments(report.id).then(setFiles).catch(() => setFiles([])), [report.id]);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    setBusy(true);
    let count = (files || []).length;
    for (const file of picked) {
      const problem = attachmentProblem(file, count);
      if (problem) { showToast(t("srAttachProblem_" + problem).replace("{name}", file.name)); continue; }
      try { await uploadAttachment(report.id, file); count += 1; }
      catch (err) { console.warn("upload failed", err); showToast(t("srAttachFailed").replace("{name}", file.name)); }
    }
    await load();
    setBusy(false);
  }

  async function remove(file) {
    if (!(await requestConfirm(t("srAttachRemoveConfirm").replace("{name}", file.name), { danger: true }))) return;
    setBusy(true);
    try { await removeAttachment(file); } catch (err) { console.warn("remove failed", err); showToast(t("srSaveError")); }
    await load();
    setBusy(false);
  }

  async function open(file) {
    try { window.open(await attachmentUrl(file), "_blank", "noopener"); }
    catch (err) { console.warn("signed url failed", err); showToast(t("srAttachOpenFailed")); }
  }

  if (files === null) return null;
  if (!editable && !files.length) return <p className="!m-0 !text-sm text-muted">{t("srNoAttachments")}</p>;

  return (
    <div className="grid gap-2">
      {files.length ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 truncate font-semibold text-card-foreground">{f.name}</span>
                <span className="shrink-0 text-meta text-muted">{ATTACHMENT_TYPES[f.type] || ""} · {fmtBytes(f.size)}</span>
              </span>
              <span className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => open(f)} aria-label={t("srAttachDownload").replace("{name}", f.name)}>
                  <Download className="h-4 w-4" aria-hidden="true" /> {t("srAttachOpen")}
                </Button>
                {editable && attachmentRemovable(f, report) ? (
                  <Button type="button" size="sm" variant="ghost" className="text-muted hover:text-accent" disabled={busy}
                    onClick={() => remove(f)} aria-label={t("srAttachRemove").replace("{name}", f.name)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {editable ? (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" id={"attach-" + report.id} onChange={add}
            disabled={busy || files.length >= ATTACHMENTS_MAX} />
          <Button type="button" variant="secondary" size="sm" className="gap-1.5" disabled={busy || files.length >= ATTACHMENTS_MAX}
            onClick={() => input.current && input.current.click()}>
            <Paperclip className="h-4 w-4" aria-hidden="true" /> {busy ? t("srAttachUploading") : t("srAttachAdd")}
          </Button>
          <span className="text-meta text-muted">{t("srAttachHelp").replace("{n}", ATTACHMENTS_MAX)}</span>
        </div>
      ) : null}
    </div>
  );
}
