// ReportParts.jsx -- pieces shared by the staff side (My Reports) and the
// reviewer side (Staff Reports): the status badge, the read-only report
// body, and the submission/review history.
import { useApp, useT } from "../../context/AppContext.jsx";
import { fmtTime, fmtDateLong } from "../../lib/utils.js";
import { statusVariant } from "../../lib/staffReports.js";
import { Badge } from "../ui/badge.jsx";

// Same fix as SnapField's SNAP_CONTROL: py-0 cancels main.css's 12px top and
// bottom padding on inputs and selects (it clips text in a 36-40px box), and
// selects keep room on the right for the chevron. Textareas set their own py.
export const REPORT_CONTROL = "w-full rounded-lg border border-border bg-background px-3 [&:is(input,select)]:py-0 [&:is(select)]:pr-9 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
export const TH = "bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]";
export const TD = "px-4 py-3 align-middle";

export function ReportStatusBadge({ status, overdue }) {
  const t = useT();
  return <Badge variant={statusVariant(status, overdue)}>{t(overdue ? "srStatus_overdue" : "srStatus_" + status)}</Badge>;
}

export function fmtStamp(iso, lang) {
  if (!iso) return "—";
  return fmtDateLong(iso.slice(0, 10), lang) + " · " + fmtTime(iso);
}

function Block({ label, children }) {
  return (
    <section className="grid gap-1.5">
      <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">{label}</h3>
      {children}
    </section>
  );
}

function Prose({ text }) {
  const t = useT();
  return text && text.trim()
    ? <p className="!m-0 whitespace-pre-wrap break-words !text-sm leading-relaxed text-card-foreground">{text}</p>
    : <p className="!m-0 !text-sm text-muted">{t("srNothingEntered")}</p>;
}

// The report body as the reviewer reads it. `content` is a report or a
// frozen version's content -- both carry the same field names.
export function ReportContent({ content }) {
  const t = useT();
  const outcomes = content.outcomes || [];
  return (
    <div className="grid gap-5">
      <Block label={t("srFieldActivities")}><Prose text={content.activities} /></Block>
      <Block label={t("srFieldAccomplishments")}><Prose text={content.accomplishments} /></Block>
      <Block label={t("srFieldOutcomes")}>
        {outcomes.length ? (
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead><tr><th className={TH}>{t("srOutcomeMetric")}</th><th className={TH}>{t("srOutcomeValue")}</th><th className={TH}>{t("srOutcomeNotes")}</th></tr></thead>
              <tbody>
                {outcomes.map((o, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className={TD}>{o.metric || "—"}</td>
                    <td className={TD + " font-semibold"}>{o.value || "—"}</td>
                    <td className={TD + " text-muted"}>{o.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="!m-0 !text-sm text-muted">{t("srNoOutcomes")}</p>}
      </Block>
      <Block label={t("srFieldChallenges")}><Prose text={content.challenges} /></Block>
      <Block label={t("srFieldAssistance")}>
        {content.noAssistanceNeeded && !String(content.assistanceNeeded || "").trim()
          ? <p className="!m-0 !text-sm text-card-foreground">{t("srNoAssistanceNeeded")}</p>
          : <Prose text={content.assistanceNeeded} />}
      </Block>
      <Block label={t("srFieldNextGoals")}><Prose text={content.nextGoals} /></Block>
      <Block label={t("srFieldComments")}><Prose text={content.comments} /></Block>
    </div>
  );
}

// Submissions and reviewer actions, oldest first, with reviewer comments.
export function ReportHistory({ history }) {
  const { data, lang } = useApp();
  const t = useT();
  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : t("srSomeone"); };
  if (!history || !history.reviews.length) return <p className="!m-0 !text-sm text-muted">{t("srNoHistory")}</p>;
  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      {history.reviews.map((r) => (
        <li key={r.id} className="rounded-lg border border-border bg-background px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-card-foreground">{t("srAction_" + r.action)} · {t("srVersionN").replace("{n}", r.version)}</span>
            <span className="text-xs text-muted">{nameOf(r.actorId)} · {fmtStamp(r.createdAt, lang)}</span>
          </div>
          {r.comment && <p className="!mb-0 !mt-1.5 whitespace-pre-wrap !text-sm text-card-foreground">{r.comment}</p>}
        </li>
      ))}
    </ol>
  );
}
