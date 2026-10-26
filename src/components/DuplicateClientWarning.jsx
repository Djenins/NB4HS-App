// DuplicateClientWarning.jsx -- "Possible existing client found", shown
// from the add-client flows (Case Management, Job Developer, Students, Food
// Distribution, Outreach contacts) when findPossibleDuplicates()
// (masterClients.js) turns up a likely match. A Dialog: it interrupts on
// purpose, so a duplicate record isn't created by accident. Never merges
// anything itself -- it routes to one of three explicit choices: enroll the
// existing client, open them, or create a new record anyway.
import { ExternalLink, UserPlus, UserRoundPlus } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { formatAddress, formatPhone } from "../lib/utils.js";
import { resolveEnrollmentsForClient } from "../lib/masterClients.js";
import NbIdBadge from "./NbIdBadge.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Dialog } from "./ui/dialog.jsx";

const PROGRAM_LABEL_KEY = { case: "navCaseManagement", job: "navJobDeveloper", student: "navStudents", food: "navFoodDistribution" };

export default function DuplicateClientWarning({ matches, onOpenExisting, onEnrollExisting, onCreateAnyway, onCancel }) {
  const { data } = useApp();
  const t = useT();
  const open = !!(matches && matches.length);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={t("duplicateWarningTitle")}
      description={t("duplicateWarningDesc")}
      size="lg"
      closeLabel={t("closeLabel")}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>{t("cancelLabel")}</Button>
          <Button variant="outline" onClick={onCreateAnyway}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />{t("createNewClientAnywayBtn")}
          </Button>
        </>
      }
    >
      {open ? (
        <ul className="m-0 list-none divide-y divide-line-subtle p-0">
          {matches.map(({ client }) => {
            const enrollments = resolveEnrollmentsForClient(client.nbId, data);
            return (
              <li key={client.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ui font-semibold text-card-foreground">{(client.firstName + " " + client.lastName).trim()}</span>
                  <NbIdBadge nbId={client.nbId} />
                </div>
                <div className="mt-1.5 grid grid-cols-1 gap-1 text-meta tabular-nums text-muted sm:grid-cols-2">
                  <span>{formatPhone(client.phone) || "—"}</span>
                  <span>{client.email || "—"}</span>
                  <span className="sm:col-span-2">{formatAddress(client) || "—"}</span>
                </div>
                {enrollments.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {enrollments.map(({ enrollment, programType }) => (
                      <Badge key={enrollment.id} variant="neutral">{t(PROGRAM_LABEL_KEY[programType] || programType)}</Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onEnrollExisting(client)}>
                    <UserRoundPlus className="h-4 w-4" aria-hidden="true" />{t("enrollExistingClientBtn")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onOpenExisting(client.nbId)}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />{t("openExistingClientBtn")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Dialog>
  );
}
