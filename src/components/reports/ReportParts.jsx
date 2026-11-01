// ReportParts.jsx -- pieces shared by the staff side (My Reports) and the
// reviewer side (Staff Reports): the status badge, program names, the
// read-only report body, and the submission/review history.
import { useCallback, useEffect, useState } from "react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { dateStrFromDate, fmtTime, fmtDateLong } from "../../lib/utils.js";
import { fetchProgramNames, programsLabel } from "../../lib/staffReports.js";
import { DataTable } from "../ui/data-table.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";

// A report's status, coloured by lib/statusTone.js ("staffReport:*").
// Overdue wins over the stored status: it's what needs attention.
export function ReportStatusBadge({ status, overdue }) {
  const t = useT();
  return (
    <StatusBadge domain="staffReport" status={overdue ? "overdue" : status} className="shrink-0">
      {t(overdue ? "srStatus_overdue" : "srStatus_" + status)}
    </StatusBadge>
  );
}

// Program names by key, loaded once per screen, and a labeller for a
// report's program list ("Organization-wide, Students").
export function useProgramLabels() {
  const t = useT();
  const [names, setNames] = useState({});
  useEffect(() => { fetchProgramNames().then(setNames).catch(() => setNames({})); }, []);
  const label = useCallback((keys) => programsLabel(keys, names, t("srOrganizationWide")) || "—", [names, t]);
  return { names, label };
}

// Date and time both in the viewer's own time zone. (The date used to be cut
// from the UTC string, so an evening submission in New York showed the next
// day's date beside the right time.)
export function fmtStamp(iso, lang) {
  if (!iso) return "—";
  return fmtDateLong(dateStrFromDate(new Date(iso)), lang) + " · " + fmtTime(iso);
}

// Label/value pairs under a report's title (period, due, programs...).
export function ReportFacts({ items }) {
  return (
    <dl className="m-0 grid gap-x-6 gap-y-1 text-ui sm:grid-cols-2">
      {items.filter(Boolean).map(([label, value]) => (
        <div key={label} className="flex min-w-0 gap-2">
          <dt className="shrink-0 text-muted">{label}:</dt>
          <dd className="m-0 min-w-0 font-semibold tabular-nums text-card-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ label, children }) {
  return (
    <section className="grid gap-1.5">
      <h3 className="m-0 text-meta font-semibold text-muted">{label}</h3>
      {children}
    </section>
  );
}

function Prose({ text }) {
  const t = useT();
  return text && text.trim()
    ? <p className="m-0 max-w-[75ch] whitespace-pre-wrap break-words text-body text-card-foreground">{text}</p>
    : <p className="m-0 text-body text-muted">{t("srNothingEntered")}</p>;
}

// The report body as the reviewer reads it. `content` is a report or a
// frozen version's content -- both carry the same field names.
export function ReportContent({ content }) {
  const t = useT();
  const outcomes = (content.outcomes || []).map((o, i) => Object.assign({ i }, o));
  return (
    <div className="grid gap-6">
      <Block label={t("srFieldActivities")}><Prose text={content.activities} /></Block>
      <Block label={t("srFieldAccomplishments")}><Prose text={content.accomplishments} /></Block>
      <Block label={t("srFieldOutcomes")}>
        <DataTable
          caption={t("srFieldOutcomes")}
          maxHeight="none"
          columns={[
            { key: "metric", header: t("srOutcomeMetric"), cell: (o) => o.metric || "—" },
            { key: "value", header: t("srOutcomeValue"), cell: (o) => o.value || "—", className: "font-semibold" },
            { key: "notes", header: t("srOutcomeNotes"), cell: (o) => o.notes || "—", className: "text-muted" }
          ]}
          rows={outcomes}
          getRowId={(o) => o.i}
          empty={<p className="m-0 text-body text-muted">{t("srNoOutcomes")}</p>}
        />
      </Block>
      <Block label={t("srFieldChallenges")}><Prose text={content.challenges} /></Block>
      <Block label={t("srFieldAssistance")}>
        {content.noAssistanceNeeded && !String(content.assistanceNeeded || "").trim()
          ? <p className="m-0 text-body text-card-foreground">{t("srNoAssistanceNeeded")}</p>
          : <Prose text={content.assistanceNeeded} />}
      </Block>
      <Block label={t("srFieldNextGoals")}><Prose text={content.nextGoals} /></Block>
      <Block label={t("srFieldComments")}><Prose text={content.comments} /></Block>
    </div>
  );
}

// Submissions and reviewer actions, oldest first, with reviewer comments.
// Divided rows rather than boxes: it always sits inside a SectionCard.
export function ReportHistory({ history }) {
  const { data, lang } = useApp();
  const t = useT();
  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : t("srSomeone"); };
  if (!history || !history.reviews.length) return <p className="m-0 text-ui text-muted">{t("srNoHistory")}</p>;
  return (
    <ol className="m-0 list-none divide-y divide-line-subtle p-0">
      {history.reviews.map((r) => (
        <li key={r.id} className="py-3 first:pt-0 last:pb-0">
          <div className="text-ui font-semibold text-card-foreground">{t("srAction_" + r.action)} · {t("srVersionN").replace("{n}", r.version)}</div>
          <div className="text-meta tabular-nums text-muted">{nameOf(r.actorId)} · {fmtStamp(r.createdAt, lang)}</div>
          {r.comment && <p className="m-0 mt-1.5 whitespace-pre-wrap text-ui text-card-foreground">{r.comment}</p>}
        </li>
      ))}
    </ol>
  );
}
