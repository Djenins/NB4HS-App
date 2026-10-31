// LogCommunicationDialog.jsx -- record a call, text, email or visit in the
// client communications log. The client profile opens it for its own client;
// the Communications log opens it with a client picker first.
import { useState } from "react";
import { useT } from "../../context/AppContext.jsx";
import { LOG_DIRECTIONS, LOG_METHODS } from "../../lib/communications.js";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { Field, Select, Textarea } from "../ui/field.jsx";
import ClientPicker from "./ClientPicker.jsx";

export const COMM_METHOD_KEY = { phone: "methodPhone", email: "methodEmail", sms: "methodSms", inperson: "methodInPerson" };
export const COMM_DIRECTION_KEY = { outbound: "directionOutbound", inbound: "directionInbound" };

// `client` fixes the client; without it the form starts with the picker.
export default function LogCommunicationDialog({ client: fixedClient, onSave, onCancel }) {
  const t = useT();
  const [client, setClient] = useState(fixedClient || null);
  const [method, setMethod] = useState("phone");
  const [direction, setDirection] = useState("outbound");
  const [summary, setSummary] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const ready = !!client && !!summary.trim();

  async function submit(e) {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    try { await onSave(client, { method, direction, summary, followUpRequired }); } finally { setSaving(false); }
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("logCommunicationBtn")}
      size="md"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={saving} disabled={!ready}>{t("saveLabel")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!fixedClient ? <ClientPicker value={client} onChange={setClient} /> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("communicationMethodLabel")} htmlFor="comm-method">
            <Select id="comm-method" value={method} onChange={(e) => setMethod(e.target.value)} data-autofocus={fixedClient ? true : undefined}>
              {LOG_METHODS.map((m) => <option key={m} value={m}>{t(COMM_METHOD_KEY[m])}</option>)}
            </Select>
          </Field>
          <Field label={t("communicationDirectionLabel")} htmlFor="comm-direction">
            <Select id="comm-direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
              {LOG_DIRECTIONS.map((d) => <option key={d} value={d}>{t(COMM_DIRECTION_KEY[d])}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t("communicationSummaryLabel")} htmlFor="comm-summary" required>
          <Textarea id="comm-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder={t("phCommunicationSummary")} />
        </Field>
        <label className="m-0 flex cursor-pointer items-center gap-2.5 text-ui font-medium text-card-foreground">
          <input type="checkbox" checked={followUpRequired} onChange={(e) => setFollowUpRequired(e.target.checked)} className="h-4 w-4 cursor-pointer accent-primary" />
          {t("followUpRequiredLabel")}
        </label>
      </div>
    </Dialog>
  );
}
