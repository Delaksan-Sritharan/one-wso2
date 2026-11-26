// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// Visas and travel documents: the tables, the details drawer and the Add / Edit dialogs, shared by Finance → Visas & Documents (the Travel Team's view of everyone's) and Me → Passport & Visas (the person's own).

import { useId, useState, type JSX } from "react";
import { Alert, Box, Button, MenuItem, TextField, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { authedGet } from "@api/http";
import { engagementServiceUrls } from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { localIsoDate } from "@utils/localDate";
import type { EmployeeOption, TravelDocument, Visa } from "../api/engagementTypes";
import { useEngagementBasis } from "../api/engagementBasis";
import { engagementFile } from "../api/engagementHttp";
import * as M from "../api/engagementMappers";
import type * as W from "../api/engagementWire";
import { usePassports, useReferenceData, useTravelDocument } from "../api/useEngagementApi";
import { useIdempotencyKey, useSaveTravelDocument } from "../api/useEngagementMutations";
import EaDialog, { ConfirmDialog } from "../components/EaDialog";
import { FactsGrid } from "../components/Facts";
import PersonPicker from "../components/PersonPicker";
import SearchSelect from "../components/SearchSelect";
import { DocumentStatusChip, Mono } from "../components/StatusChips";
import { documentStatus, visaStatus } from "./documentColumns";
import { fmtDate } from "../model/format";
import RecordDrawer from "../components/RecordDrawer";
import { DOCUMENT_TYPES, ENTRY_TYPES, VISA_TYPES } from "../model/statuses";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The Travel Team's add dialogs: the traveller's records for one country, asked of the server. The table
 * behind the dialog holds one filtered page only, so an existing Active record may not be in it.
 */
async function travellerRecords<TW, TV>(url: string, token: string, map: (w: TW) => TV): Promise<readonly TV[]> {
  return (await authedGet<W.WPage<TW>>(url, token)).items.map(map);
}
const IMAGE_TYPES = ["image/jpeg", "image/png"];

/** Opens the record's image or PDF in a new tab; anything else is refused. */
function ViewFile({ id, visa }: { id: string; visa: boolean }): JSX.Element {
  const { getToken } = useEngagementBasis();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Box>
      <Button
        variant="outlined"
        size="small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const blob = await engagementFile(visa ? engagementServiceUrls.visaImage(id) : engagementServiceUrls.travelDocumentImage(id), await getToken());
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          } catch (e) {
            setError(`Couldn't open the image. ${describeError(e)}`);
          } finally {
            setBusy(false);
          }
        }}
      >
        View Image
      </Button>
      {error ? (
        <Typography variant="caption" color="error" component="div" sx={{ mt: 0.5 }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}

/** Visa Information / Document Details in a side drawer; Edit sits in the footer for the Travel Team. */
export function DocumentDrawer({
  record,
  own,
  canEdit,
  onEdit,
  onClose,
}: {
  record: Visa | TravelDocument;
  own: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}): JSX.Element {
  const today = localIsoDate();
  const visa = record.kind === "visa";
  return (
    <RecordDrawer
      title={visa ? "Visa Information" : "Document Details"}
      subtitle={own ? (visa ? record.visaType : record.type) : record.owner?.name}
      onClose={onClose}
      actions={
        canEdit ? (
          <Button variant="contained" onClick={onEdit}>
            {visa ? "Edit Visa" : "Edit Travel Document"}
          </Button>
        ) : undefined
      }
    >
        <FactsGrid
          columns={2}
          facts={
            visa
              ? [
                  !own && { label: "Email", value: record.owner?.email },
                  { label: "Country", value: record.country },
                  { label: "Visa Type", value: record.visaType },
                  { label: "Entry Type", value: record.entryType },
                  { label: "Start Date", value: fmtDate(record.start) },
                  { label: "End Date", value: fmtDate(record.end) },
                  { label: "Issued Date", value: record.issued ? fmtDate(record.issued) : undefined },
                  { label: "Passport", value: record.passport ?? "No Passport Tagged" },
                  { label: "Visa Status", value: <DocumentStatusChip status={visaStatus(record, today)} /> },
                ]
              : [
                  !own && { label: "Email", value: record.owner?.email },
                  { label: "Document Number", value: <Mono>{record.number}</Mono> },
                  { label: "Document Type", value: record.type },
                  { label: "Issued Country", value: record.country },
                  { label: "Issued Date", value: record.issued ? fmtDate(record.issued) : undefined },
                  { label: "Expiry Date", value: record.expires ? fmtDate(record.expires) : "No expiry date" },
                  { label: "Status", value: <DocumentStatusChip status={documentStatus(record, today)} /> },
                ]
          }
        />
        <Box sx={{ mt: 2.5 }}>{record.hasFile ? <ViewFile id={record.id} visa={visa} /> : <Alert severity="info">No image available</Alert>}</Box>
    </RecordDrawer>
  );
}

function FilePicker({ label, file, onFile, hint, error }: { label: string; file: File | null; onFile: (f: File | null, problem?: string) => void; hint: string; error?: string }) {
  const messageId = useId();
  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
      <Button variant="outlined" component="label" size="small">
        {label}
        <input
          hidden
          type="file"
          accept=".jpg,.jpeg,.png"
          aria-invalid={Boolean(error)}
          aria-describedby={messageId}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && !IMAGE_TYPES.includes(f.type)) return onFile(null, "Upload a JPG or PNG image.");
            if (f && f.size > MAX_BYTES) return onFile(null, "The image must be 5 MB or smaller.");
            onFile(f);
          }}
        />
      </Button>
      <Typography id={messageId} role={error ? "alert" : undefined} variant="caption" color={error ? "error" : "text.secondary"} component="div" sx={{ mt: 0.5 }}>
        {error ?? (file ? file.name : hint)}
      </Typography>
    </Box>
  );
}

/** Each field's own message, set when Continue is refused. */
type FieldErrors = Readonly<Record<string, string>>;

const select = (label: string, value: string, options: readonly string[], onChange: (v: string) => void, required = true, error?: string) => (
  <TextField select size="small" required={required} label={label} value={value} error={Boolean(error)} helperText={error} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => (
      <MenuItem key={o} value={o}>
        {o}
      </MenuItem>
    ))}
  </TextField>
);


/** Add / Edit Visa, fields in the legacy order: Traveller's Email (the Travel Team adding for someone), Country, Visa Type, Entry Type, Issued Date, Valid From and To, Passport, Status (edit), Image. */
export function VisaDialog({ own, visa, existing, onClose }: { own: boolean; visa?: Visa; existing: readonly Visa[]; onClose: () => void }): JSX.Element {
  const ref = useReferenceData();
  const save = useSaveTravelDocument(own);
  const idem = useIdempotencyKey();
  const notify = useNotifications();
  const today = localIsoDate();
  const [owner, setOwner] = useState<EmployeeOption | null>(visa?.owner ? { ...visa.owner } : null);
  const [f, setF] = useState({
    country: visa?.country ?? "",
    visaType: visa?.visaType ?? "",
    entryType: visa?.entryType ?? "",
    issued: visa?.issued ?? "",
    start: visa?.start ?? "",
    end: visa?.end ?? "",
    passport: visa?.passportId ?? "",
    status: visa ? visaStatus(visa, today) : "Active",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<unknown>();
  const [errs, setErrs] = useState<FieldErrors>({});
  const [confirm, setConfirm] = useState<{ text: string; label: string; busy: string; danger?: boolean } | null>(null);
  // Going back from the confirm step restores the form with its edits, so Cancel keeps asking before it discards them.
  const [wentBack, setWentBack] = useState(false);
  const passportsQuery = usePassports(own ? undefined : owner?.email, own);
  const passports = (passportsQuery.data ?? []).filter((d) => d.status !== "Inactive");
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const ownerEmail = own ? undefined : owner?.email;
  const { getToken } = useEngagementBasis();

  if (confirm) {
    return (
      <ConfirmDialog
        title={visa ? "Edit Visa" : "Add Visa"}
        text={confirm.text}
        confirmLabel={confirm.label}
        busyLabel={confirm.busy}
        cancelLabel="Go Back"
        danger={confirm.danger}
        run={() =>
          save.mutateAsync({
            id: visa?.id,
            idempotencyKey: visa ? undefined : idem.key,
            kind: "visa",
            travellerEmail: visa ? undefined : ownerEmail,
            fields: {
              country: f.country,
              visaType: f.visaType,
              entryType: f.entryType,
              issuedDate: f.issued,
              startDate: f.start,
              endDate: f.end,
              passportId: f.passport,
              ...(visa ? { status: f.status } : {}),
            },
            image: file ?? undefined,
          })
        }
        onDone={() => {
          notify.showSuccess(visa ? "Visa updated successfully" : "Visa added successfully");
          onClose();
        }}
        onClose={() => {
          setConfirm(null);
          setWentBack(true);
        }}
      />
    );
  }

  return (
    <EaDialog
      title={visa ? "Edit Visa" : "Add Visa"}
      confirmLabel="Continue"
      error={error}
      edited={wentBack}
      onClose={onClose}
      onConfirm={async () => {
        const inactive = f.status === "Inactive";
        const next: Record<string, string> = {};
        if (!inactive) {
          if (!own && !owner) next.owner = "Select the traveller";
          if (!f.country) next.country = "Select the country";
          if (!f.visaType) next.visaType = "Select the visa type";
          if (!f.entryType) next.entryType = "Select the entry type";
          if (!f.issued) next.issued = "Enter the issued date";
          if (!f.start) next.start = "Enter the date the visa is valid from";
          if (!f.end) next.end = "Enter the date the visa is valid to";
          if (!f.passport) next.passport = "Select the passport";
          if (!(file || visa?.hasFile)) next.image = "Add an image of the visa information page";
        }
        if (f.start && f.end && f.start > f.end) next.end = "Valid To must be on or after Valid From";
        setErrs(next);
        if (Object.keys(next).length) return;
        setError(undefined);
        let pool = existing;
        if (!visa && !own && owner) {
          try {
            pool = await travellerRecords(engagementServiceUrls.visas({ traveller: owner.email, country: f.country, limit: 500 }), await getToken(), M.visa);
          } catch (e) {
            return setError(e);
          }
        }
        const clash = pool.some((x) => x.status === "Active" && x.country === f.country && x.id !== visa?.id && (own || x.owner?.email === owner?.email));
        setConfirm(
          visa
            ? inactive
              ? { text: "This visa will be marked as Inactive, and this cannot be undone. Check that the information is correct. Save your changes?", label: "Save Changes", busy: "Saving…", danger: true }
              : { text: "Check that the information is correct. Save your changes to this visa?", label: "Save Changes", busy: "Saving…" }
            : clash
              ? {
                  text: `${own ? "You already have" : "This traveller already has"} a visa for the same country. Adding this one replaces it, and this cannot be undone. Check that the information is correct. Replace it?`,
                  label: "Replace and Add Visa",
                  busy: "Adding…",
                  danger: true,
                }
              : { text: "Check that the information is correct. Add this visa?", label: "Add Visa", busy: "Adding…" },
        );
      }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: 1 }}>
        {visa ? (
          !own ? <TextField size="small" label="Traveller's Email" value={visa.owner?.email ?? ""} disabled sx={{ gridColumn: "1 / -1" }} /> : null
        ) : !own ? (
          <Box sx={{ gridColumn: "1 / -1" }}>
            <PersonPicker label="Traveller's Email" required value={owner} onChange={setOwner} placeholder="Select the traveller" error={errs.owner} />
          </Box>
        ) : null}
        <SearchSelect label="Country" required value={f.country} options={ref.data?.countries ?? []} onChange={set("country")} error={errs.country} />
        {select("Visa Type", f.visaType, VISA_TYPES, set("visaType"), true, errs.visaType)}
        {select("Entry Type", f.entryType, ENTRY_TYPES, set("entryType"), true, errs.entryType)}
        <TextField size="small" type="date" required label="Issued Date" error={Boolean(errs.issued)} helperText={errs.issued} value={f.issued} onChange={(e) => set("issued")(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" required label="Valid From" error={Boolean(errs.start)} helperText={errs.start} value={f.start} onChange={(e) => set("start")(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" required label="Valid To" error={Boolean(errs.end)} helperText={errs.end} value={f.end} onChange={(e) => set("end")(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField
          select
          size="small"
          label="Passport"
          required
          value={f.passport}
          disabled={!own && !owner}
          error={Boolean(errs.passport)}
          helperText={errs.passport ?? (!own && !owner ? "Select the traveller first" : undefined)}
          onChange={(e) => set("passport")(e.target.value)}
        >
          {passports.map((d) => (
            <MenuItem key={d.id} value={d.id} disabled={Boolean(d.expires && d.expires < today)}>
              {`${d.country} - ${d.number} (${d.issued ? fmtDate(d.issued) : "—"} – ${d.expires ? fmtDate(d.expires) : "No expiry date"})`}
            </MenuItem>
          ))}
        </TextField>
        {visa ? select("Status", f.status, ["Active", "Inactive", "Expired"], set("status"), false) : <span />}
        <FilePicker
          label={visa ? "Edit Image" : "Image"}
          file={file}
          onFile={(x, problem) => {
            setFile(x);
            if (problem) setError(problem);
          }}
          error={errs.image}
          hint="Browse an image of the visa information page (JPG or PNG, 5 MB at most)."
        />
      </Box>
    </EaDialog>
  );
}

/** Add / Edit Travel Document: Traveller's Email, Document Type, Document Number, Issued Country, Status (edit), Issued and Expiry Date (not required for an Other ID Document), Image. */
export function DocumentDialog({
  own,
  doc,
  existing,
  onClose,
}: {
  own: boolean;
  doc?: TravelDocument;
  existing: readonly TravelDocument[];
  onClose: () => void;
}): JSX.Element {
  const ref = useReferenceData();
  const save = useSaveTravelDocument(own);
  const idem = useIdempotencyKey();
  const notify = useNotifications();
  // The full number comes only from the record itself (Edit Travel Document); the list carries it masked.
  const full = useTravelDocument(doc?.id, Boolean(doc) && !own);
  const [owner, setOwner] = useState<EmployeeOption | null>(doc?.owner ? { ...doc.owner } : null);
  const [f, setF] = useState({
    type: doc?.type ?? "",
    number: "",
    country: doc?.country ?? "",
    issued: doc?.issued ?? "",
    expires: doc?.expires ?? "",
    status: doc?.status === "Inactive" ? "Inactive" : "Active",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<unknown>();
  const [errs, setErrs] = useState<FieldErrors>({});
  const [confirm, setConfirm] = useState<{ text: string; label: string; busy: string; danger?: boolean } | null>(null);
  // Going back from the confirm step restores the form with its edits, so Cancel keeps asking before it discards them.
  const [wentBack, setWentBack] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const other = f.type === "Other ID Document";
  const { getToken } = useEngagementBasis();

  if (confirm) {
    return (
      <ConfirmDialog
        title={doc ? "Edit Travel Document" : "Add Travel Document"}
        text={confirm.text}
        confirmLabel={confirm.label}
        busyLabel={confirm.busy}
        cancelLabel="Go Back"
        danger={confirm.danger}
        run={() =>
          save.mutateAsync({
            id: doc?.id,
            idempotencyKey: doc ? undefined : idem.key,
            kind: "document",
            travellerEmail: own || doc ? undefined : owner?.email,
            fields: {
              documentType: f.type,
              documentNumber: f.number,
              country: f.country,
              issuedDate: f.issued,
              expiryDate: f.expires,
              ...(doc ? { status: f.status } : {}),
            },
            image: file ?? undefined,
          })
        }
        onDone={() => {
          notify.showSuccess(doc ? "Travel document updated successfully" : "Travel document added successfully");
          onClose();
        }}
        onClose={() => {
          setConfirm(null);
          setWentBack(true);
        }}
      />
    );
  }

  return (
    <EaDialog
      title={doc ? "Edit Travel Document" : "Add Travel Document"}
      confirmLabel="Continue"
      error={error}
      edited={wentBack}
      onClose={onClose}
      onConfirm={async () => {
        // On edit the masked number stands unless a new one is typed.
        const number = f.number || (doc ? "unchanged" : "");
        const next: Record<string, string> = {};
        if (!own && !owner) next.owner = "Select the traveller";
        if (!f.type) next.type = "Select the document type";
        if (!number) next.number = "Enter the document number";
        if (!f.country) next.country = "Select the issued country";
        if (!other && !f.expires) next.expires = "Enter the expiry date";
        if (!(file || doc?.hasFile)) next.image = "Add an image of the document details page";
        if (!other && f.issued && f.expires && f.issued > f.expires) next.expires = "Expiry Date must be on or after Issued Date";
        setErrs(next);
        if (Object.keys(next).length) return;
        setError(undefined);
        let pool = existing;
        if (!doc && !own && owner) {
          try {
            pool = await travellerRecords(
              engagementServiceUrls.travelDocuments({ traveller: owner.email, country: f.country, documentType: f.type, limit: 500 }),
              await getToken(),
              M.travelDocument,
            );
          } catch (e) {
            return setError(e);
          }
        }
        const clash = pool.some((x) => x.status === "Active" && x.type === f.type && x.country === f.country && x.id !== doc?.id && (own || x.owner?.email === owner?.email));
        setConfirm(
          doc
            ? f.status === "Inactive"
              ? { text: "This travel document will be marked as Inactive, and this cannot be undone. Check that the information is correct. Save your changes?", label: "Save Changes", busy: "Saving…", danger: true }
              : { text: "Check that the information is correct. Save your changes to this travel document?", label: "Save Changes", busy: "Saving…" }
            : clash
              ? {
                  text: `${own ? "You already have" : "This traveller already has"} a travel document of the same type for the same country. Adding this one replaces it, and this cannot be undone. Check that the information is correct. Replace it?`,
                  label: "Replace and Add Document",
                  busy: "Adding…",
                  danger: true,
                }
              : { text: "Check that the information is correct. Add this travel document?", label: "Add Document", busy: "Adding…" },
        );
      }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: 1 }}>
        {doc ? (
          !own ? <TextField size="small" label="Traveller's Email" value={doc.owner?.email ?? ""} disabled sx={{ gridColumn: "1 / -1" }} /> : null
        ) : !own ? (
          <Box sx={{ gridColumn: "1 / -1" }}>
            <PersonPicker label="Traveller's Email" required value={owner} onChange={setOwner} placeholder="Select the traveller" error={errs.owner} />
          </Box>
        ) : null}
        {select("Document Type", f.type, DOCUMENT_TYPES, set("type"), true, errs.type)}
        <TextField
          size="small"
          required={!doc}
          label="Document Number"
          value={f.number}
          placeholder={doc ? (full.data?.fullNumber ?? doc.number) : undefined}
          error={Boolean(errs.number)}
          helperText={errs.number ?? (doc ? "Leave empty to keep the current number." : undefined)}
          onChange={(e) => set("number")(e.target.value)}
        />
        <SearchSelect label="Issued Country" required value={f.country} options={ref.data?.countries ?? []} onChange={set("country")} error={errs.country} />
        {doc ? select("Status", f.status, ["Active", "Inactive"], set("status"), false) : <span />}
        <TextField size="small" type="date" required={!other} label="Issued Date" value={f.issued} onChange={(e) => set("issued")(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField
          size="small"
          type="date"
          required={!other}
          label="Expiry Date"
          value={f.expires}
          error={Boolean(errs.expires)}
          helperText={errs.expires ?? "Not required for Other ID Document"}
          onChange={(e) => set("expires")(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FilePicker
          label={doc ? "Edit Image" : "Image"}
          file={file}
          onFile={(x, problem) => {
            setFile(x);
            if (problem) setError(problem);
          }}
          error={errs.image}
          hint="Browse an image of the document details page (JPG or PNG, 5 MB at most)."
        />
      </Box>
    </EaDialog>
  );
}
