// DuplicateClientWarning.jsx -- "Possible existing client found" modal shown
// from Case Management/Job Developer's add-client flows when
// findPossibleDuplicates() (masterClients.js) turns up a likely match.
// Reuses the app's existing modal-overlay/modal-box markup (same idiom as
// ConfirmModal.jsx -- there's no shadcn Dialog primitive installed) rather
// than inventing a new modal shell. Never merges anything itself -- just
// routes the user to one of three explicit choices.
import { useEffect } from "react";
import { ExternalLink, UserPlus, UserRoundPlus } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { formatAddress, formatPhone } from "../lib/utils.js";
import { resolveEnrollmentsForClient } from "../lib/masterClients.js";
import NbIdBadge from "./NbIdBadge.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";

const PROGRAM_LABEL_KEY = { case: "navCaseManagement", job: "navJobDeveloper", student: "navStudents", food: "navFoodDistribution" };

export default function DuplicateClientWarning({ matches, onOpenExisting, onEnrollExisting, onCreateAnyway, onCancel }) {
  const { data } = useApp();
  const t = useT();

  useEffect(() => {
    function onKeydown(e) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [onCancel]);

  if (!matches || !matches.length) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-2xl" role="alertdialog" aria-modal="true" aria-labelledby="dup-warning-title">
        <p id="dup-warning-title" className="mb-1 text-base font-bold text-card-foreground">{t("duplicateWarningTitle")}</p>
        <p className="mb-4 text-sm text-muted">{t("duplicateWarningDesc")}</p>

        <div className="max-h-72 space-y-3 overflow-auto">
          {matches.map(({ client }) => {
            const enrollments = resolveEnrollmentsForClient(client.nbId, data);
            return (
              <div key={client.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-card-foreground">{(client.firstName + " " + client.lastName).trim()}</span>
                  <NbIdBadge nbId={client.nbId} />
                </div>
                <div className="mt-1.5 grid grid-cols-1 gap-1 text-sm text-muted sm:grid-cols-2">
                  <span>{formatPhone(client.phone) || "—"}</span>
                  <span>{client.email || "—"}</span>
                  <span className="sm:col-span-2">{formatAddress(client) || "—"}</span>
                </div>
                {enrollments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {enrollments.map(({ enrollment, programType }) => (
                      <Badge key={enrollment.id} variant="neutral">{t(PROGRAM_LABEL_KEY[programType] || programType)}</Badge>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => onEnrollExisting(client)}>
                    <UserRoundPlus className="h-3.5 w-3.5" /> {t("enrollExistingClientBtn")}
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-2 gap-1.5" onClick={() => onOpenExisting(client.nbId)}>
                    <ExternalLink className="h-3.5 w-3.5" /> {t("openExistingClientBtn")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button variant="outline" className="gap-1.5" onClick={onCreateAnyway}>
            <UserPlus className="h-4 w-4" /> {t("createNewClientAnywayBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}
